import { Server } from 'socket.io';
import env from '../config/env.js';
import Room from '../models/Room.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import presence from './presence.js';
import { verifyToken } from '../utils/token.js';
import { messageContent, roomSlug } from '../validators/schemas.js';

/** Responde ao callback de confirmação (ack) do cliente, se houver. */
const reply = (ack, payload) => typeof ack === 'function' && ack(payload);
const fail = (ack, error) => reply(ack, { ok: false, error });

/** Limite simples de mensagens por socket (janela deslizante). */
function createRateLimiter(limit, windowMs) {
  const hits = [];
  return () => {
    const now = Date.now();
    while (hits.length && hits[0] <= now - windowMs) hits.shift();
    if (hits.length >= limit) return false;
    hits.push(now);
    return true;
  };
}

export default function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',') },
  });

  // Autenticação no handshake: o usuário vem do token, nunca do cliente
  io.use((socket, next) => {
    try {
      const payload = verifyToken(socket.handshake.auth?.token);
      socket.data.user = { id: payload.sub, username: payload.username };
      return next();
    } catch {
      return next(new Error('Não autorizado'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;
    const joined = new Set();
    const allowMessage = createRateLimiter(env.MESSAGE_RATE_LIMIT, env.MESSAGE_RATE_WINDOW_MS);

    if (presence.connect(user.username)) socket.broadcast.emit('user:online', user.username);
    socket.emit('presence:list', presence.online());

    const emitRoomUsers = (room) =>
      io.to(room).emit('room:users', { room, users: presence.usersInRoom(room) });

    socket.on('room:join', async (rawRoom, ack) => {
      const parsed = roomSlug.safeParse(rawRoom);
      if (!parsed.success) return fail(ack, 'Sala inválida');
      const room = parsed.data;
      if (!(await Room.exists({ slug: room }))) return fail(ack, 'Sala não encontrada');

      if (!joined.has(room)) {
        joined.add(room);
        socket.join(room);
        presence.join(room, user.username);
        emitRoomUsers(room);
      }
      return reply(ack, { ok: true, room, users: presence.usersInRoom(room) });
    });

    socket.on('room:leave', (room, ack) => {
      if (joined.delete(room)) {
        socket.leave(room);
        presence.leave(room, user.username);
        emitRoomUsers(room);
      }
      reply(ack, { ok: true });
    });

    socket.on('message:send', async (payload, ack) => {
      const room = payload?.room;
      if (!joined.has(room)) return fail(ack, 'Entre na sala antes de enviar mensagens');

      const content = messageContent.safeParse(payload?.content);
      if (!content.success) return fail(ack, content.error.issues[0].message);
      if (!allowMessage()) return fail(ack, 'Você está enviando mensagens rápido demais');

      try {
        const message = await Message.create({
          room,
          user: user.id,
          username: user.username,
          content: content.data,
        });
        io.to(room).emit('message:new', message.toJSON());
        return reply(ack, { ok: true, message: message.toJSON() });
      } catch {
        return fail(ack, 'Não foi possível enviar a mensagem');
      }
    });

    socket.on('typing', ({ room, typing } = {}) => {
      if (joined.has(room))
        socket.to(room).emit('typing', { room, username: user.username, typing: Boolean(typing) });
    });

    socket.on('disconnect', async () => {
      for (const room of joined) {
        presence.leave(room, user.username);
        emitRoomUsers(room);
      }
      if (presence.disconnect(user.username)) {
        io.emit('user:offline', user.username);
        await User.updateOne({ _id: user.id }, { lastSeenAt: new Date() }).catch(() => {});
      }
    });
  });

  return io;
}
