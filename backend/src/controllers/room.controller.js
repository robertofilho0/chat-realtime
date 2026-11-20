import Room from '../models/Room.js';
import Message from '../models/Message.js';
import AppError from '../utils/AppError.js';
import presence from '../realtime/presence.js';

export async function list(_req, res) {
  const [rooms, counts] = await Promise.all([
    Room.find().sort({ createdAt: 1 }),
    Message.aggregate([{ $group: { _id: '$room', total: { $sum: 1 } } }]),
  ]);
  const totals = new Map(counts.map((c) => [c._id, c.total]));
  res.json(
    rooms.map((room) => ({
      ...room.toJSON(),
      messageCount: totals.get(room.slug) || 0,
      onlineCount: presence.usersInRoom(room.slug).length,
    })),
  );
}

export async function create(req, res) {
  if (await Room.exists({ slug: req.body.slug }))
    throw AppError.conflict('Já existe uma sala com este identificador');
  const room = await Room.create({ ...req.body, createdBy: req.user.id });
  res.status(201).json(room);
}

/** Histórico paginado por cursor: use `before` com o id da mensagem mais antiga recebida. */
export async function history(req, res) {
  const { slug } = req.validated.params;
  const { before, limit } = req.validated.query;
  if (!(await Room.exists({ slug }))) throw AppError.notFound('Sala não encontrada');

  const filter = { room: slug };
  if (before) filter._id = { $lt: before };

  const messages = await Message.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1);
  const hasMore = messages.length > limit;
  const page = messages.slice(0, limit).reverse(); // ordem cronológica

  res.json({ data: page, hasMore, nextCursor: hasMore ? page[0].id : null });
}
