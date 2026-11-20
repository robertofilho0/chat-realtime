import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { signToken } from '../utils/token.js';

const DUMMY_HASH = bcrypt.hashSync('dummy-password', 4);

export async function register(req, res) {
  if (await User.exists({ username: req.body.username })) {
    throw AppError.conflict('Este username já está em uso');
  }
  const user = await User.create(req.body);
  res.status(201).json({ token: signToken(user), user });
}

export async function login(req, res) {
  const user = await User.findOne({ username: req.body.username }).select('+password');
  const ok = await bcrypt.compare(req.body.password, user ? user.password : DUMMY_HASH);
  if (!user || !ok) throw AppError.unauthorized('Credenciais inválidas');
  res.json({ token: signToken(user), user });
}

export async function me(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) throw AppError.notFound('Usuário não encontrado');
  res.json(user);
}
