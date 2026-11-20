import AppError from '../utils/AppError.js';
import { verifyToken } from '../utils/token.js';

export default function requireAuth(req, _res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return next(AppError.unauthorized('Token não fornecido'));
  const payload = verifyToken(token);
  req.user = { id: payload.sub, username: payload.username };
  return next();
}
