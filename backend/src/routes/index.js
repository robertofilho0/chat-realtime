import { Router } from 'express';
import validate from '../middlewares/validate.js';
import requireAuth from '../middlewares/auth.js';
import * as s from '../validators/schemas.js';
import * as auth from '../controllers/auth.controller.js';
import * as rooms from '../controllers/room.controller.js';

const router = Router();

router.post('/auth/register', validate({ body: s.register }), auth.register);
router.post('/auth/login', validate({ body: s.login }), auth.login);
router.get('/auth/me', requireAuth, auth.me);

router.get('/rooms', requireAuth, rooms.list);
router.post('/rooms', requireAuth, validate({ body: s.createRoom }), rooms.create);
router.get(
  '/rooms/:slug/messages',
  requireAuth,
  validate({ params: s.roomParams, query: s.history }),
  rooms.history,
);

export default router;
