import {
  ConflictException,
  Injectable,
  NotFoundException,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import type { Message, Room, User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateRoomInput, HistoryQuery } from './rooms.schemas.js';

const DEFAULT_ROOMS = [
  { slug: 'geral', name: 'Geral', description: 'Conversa livre' },
  { slug: 'dev', name: 'Dev', description: 'Programação e tecnologia' },
];

export type MessageWithRelations = Message & {
  room: Pick<Room, 'slug'>;
  user: Pick<User, 'username'>;
};

/** Formato público da mensagem (o mesmo usado nos eventos do socket). */
export const toMessageResponse = (m: MessageWithRelations) => ({
  id: m.id,
  room: m.room.slug,
  username: m.user.username,
  content: m.content,
  createdAt: m.createdAt,
});

export const messageInclude = {
  room: { select: { slug: true } },
  user: { select: { username: true } },
} as const;

@Injectable()
export class RoomsService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  /** Garante que as salas padrão existam. */
  async onApplicationBootstrap() {
    await this.ensureDefaultRooms();
  }

  async ensureDefaultRooms() {
    for (const room of DEFAULT_ROOMS) {
      await this.prisma.room.upsert({
        where: { slug: room.slug },
        update: {},
        create: room,
      });
    }
  }

  findBySlug(slug: string) {
    return this.prisma.room.findUnique({ where: { slug } });
  }

  async list(onlineCount: (slug: string) => number) {
    const rooms = await this.prisma.room.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { messages: true } } },
    });
    return rooms.map(({ _count, ...room }) => ({
      ...room,
      messageCount: _count.messages,
      onlineCount: onlineCount(room.slug),
    }));
  }

  async create(userId: string, data: CreateRoomInput) {
    if (await this.findBySlug(data.slug))
      throw new ConflictException('Já existe uma sala com este identificador');
    return this.prisma.room.create({ data: { ...data, createdById: userId } });
  }

  /** Histórico paginado por cursor: use `before` com o id da mensagem mais antiga recebida. */
  async history(slug: string, { before, limit }: HistoryQuery) {
    const room = await this.findBySlug(slug);
    if (!room) throw new NotFoundException('Sala não encontrada');

    const messages = await this.prisma.message.findMany({
      where: { roomId: room.id },
      include: messageInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(before && { cursor: { id: before }, skip: 1 }),
      take: limit + 1,
    });
    const hasMore = messages.length > limit;
    const page = messages.slice(0, limit).reverse().map(toMessageResponse); // ordem cronológica
    return { data: page, hasMore, nextCursor: hasMore ? page[0].id : null };
  }

  async saveMessage(roomId: string, userId: string, content: string) {
    const message = await this.prisma.message.create({
      data: { roomId, userId, content },
      include: messageInclude,
    });
    return toMessageResponse(message);
  }
}
