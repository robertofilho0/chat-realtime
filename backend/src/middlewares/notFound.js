import AppError from '../utils/AppError.js';

export default (req, _res, next) => {
  next(AppError.notFound(`Rota ${req.method} ${req.originalUrl} não encontrada`));
};
