import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service.js';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  messageContentSchema,
  roomSlugSchema,
} from '../rooms/rooms.schemas.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { PresenceService } from './presence.service.js';

interface SocketData {
  user: { id: string; username: string };
  rooms: Map<string, string>; // slug -> roomId
  allowMessage: () => boolean;
}
type ChatSocket = Socket & { data: SocketData };
type Ack = { ok: true; [key: string]: unknown } | { ok: false; error: string };

/** Limite simples de mensagens por conexão (janela deslizante). */
function createRateLimiter(limit: number, windowMs: number) {
  const hits: number[] = [];
  return () => {
    const now = Date.now();
    while (hits.length && hits[0] <= now - windowMs) hits.shift();
    if (hits.length >= limit) return false;
    hits.push(now);
    return true;
  };
}

@WebSocketGateway({ cors: { origin: true } })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly auth: AuthService,
    private readonly rooms: RoomsService,
    private readonly presence: PresenceService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Autenticação no handshake: o usuário vem do token, nunca do cliente. */
  afterInit(server: Server) {
    server.use((socket: ChatSocket, next) => {
      this.auth
        .verify(String(socket.handshake.auth?.token ?? ''))
        .then((payload) => {
          socket.data.user = { id: payload.sub, username: payload.username };
          socket.data.rooms = new Map();
          socket.data.allowMessage = createRateLimiter(
            this.config.get('MESSAGE_RATE_LIMIT', { infer: true }),
            this.config.get('MESSAGE_RATE_WINDOW_MS', { infer: true }),
          );
          next();
        })
        .catch(() => next(new Error('Não autorizado')));
    });
  }

  handleConnection(socket: ChatSocket) {
    const { username } = socket.data.user;
    if (this.presence.connect(username))
      socket.broadcast.emit('user:online', username);
    socket.emit('presence:list', this.presence.online());
  }

  async handleDisconnect(socket: ChatSocket) {
    if (!socket.data.user) return;
    const { id, username } = socket.data.user;
    for (const slug of socket.data.rooms.keys()) {
      this.presence.leave(slug, username);
      this.emitRoomUsers(slug);
    }
    if (this.presence.disconnect(username)) {
      this.server.emit('user:offline', username);
      await this.prisma.user
        .update({ where: { id }, data: { lastSeenAt: new Date() } })
        .catch(() => undefined);
    }
  }

  private emitRoomUsers(slug: string) {
    this.server.to(slug).emit('room:users', {
      room: slug,
      users: this.presence.usersInRoom(slug),
    });
  }

  @SubscribeMessage('room:join')
  async join(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() raw: unknown,
  ): Promise<Ack> {
    const parsed = roomSlugSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: 'Sala inválida' };
    const slug = parsed.data;

    const room = await this.rooms.findBySlug(slug);
    if (!room) return { ok: false, error: 'Sala não encontrada' };

    if (!socket.data.rooms.has(slug)) {
      socket.data.rooms.set(slug, room.id);
      await socket.join(slug);
      this.presence.join(slug, socket.data.user.username);
      this.emitRoomUsers(slug);
    }
    return { ok: true, room: slug, users: this.presence.usersInRoom(slug) };
  }

  @SubscribeMessage('room:leave')
  async leave(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() slug: string,
  ): Promise<Ack> {
    if (socket.data.rooms.delete(slug)) {
      await socket.leave(slug);
      this.presence.leave(slug, socket.data.user.username);
      this.emitRoomUsers(slug);
    }
    return { ok: true };
  }

  @SubscribeMessage('message:send')
  async send(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() payload: { room?: string; content?: unknown } | undefined,
  ): Promise<Ack> {
    const slug = payload?.room ?? '';
    const roomId = socket.data.rooms.get(slug);
    if (!roomId)
      return { ok: false, error: 'Entre na sala antes de enviar mensagens' };

    const content = messageContentSchema.safeParse(payload?.content);
    if (!content.success)
      return { ok: false, error: content.error.issues[0].message };
    if (!socket.data.allowMessage())
      return { ok: false, error: 'Você está enviando mensagens rápido demais' };

    try {
      const message = await this.rooms.saveMessage(
        roomId,
        socket.data.user.id,
        content.data,
      );
      this.server.to(slug).emit('message:new', message);
      return { ok: true, message };
    } catch (error) {
      this.logger.error(
        `Falha ao salvar mensagem: ${(error as Error).message}`,
      );
      return { ok: false, error: 'Não foi possível enviar a mensagem' };
    }
  }

  @SubscribeMessage('typing')
  typing(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() payload: { room?: string; typing?: boolean } | undefined,
  ) {
    const slug = payload?.room ?? '';
    if (socket.data.rooms.has(slug)) {
      socket.to(slug).emit('typing', {
        room: slug,
        username: socket.data.user.username,
        typing: Boolean(payload?.typing),
      });
    }
  }
}
