import request from 'supertest';
import app from '../src/app.js';
import Message from '../src/models/Message.js';
import * as db from './helpers/db.js';
import { createUser, createRoom } from './helpers/server.js';

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('Autenticação', () => {
  it('registra, faz login e consulta o perfil', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ username: 'Roberto', password: 'Senha123' });
    expect(reg.status).toBe(201);
    expect(reg.body.user).toMatchObject({ username: 'roberto' });
    expect(reg.body.user.password).toBeUndefined();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'roberto', password: 'Senha123' });
    expect(login.status).toBe(200);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(me.body.username).toBe('roberto');
  });

  it('rejeita username duplicado, senha fraca e credenciais erradas', async () => {
    await createUser('ana');
    expect(
      (
        await request(app)
          .post('/api/auth/register')
          .send({ username: 'ana', password: 'Senha123' })
      ).status,
    ).toBe(409);
    expect(
      (await request(app).post('/api/auth/register').send({ username: 'bia', password: '123' }))
        .status,
    ).toBe(400);
    expect(
      (await request(app).post('/api/auth/login').send({ username: 'ana', password: 'Errada123' }))
        .status,
    ).toBe(401);
  });
});

describe('Salas e histórico', () => {
  it('exige autenticação', async () => {
    expect((await request(app).get('/api/rooms')).status).toBe(401);
  });

  it('cria e lista salas com contagem de mensagens', async () => {
    const { token, user } = await createUser('ana');
    const auth = { Authorization: `Bearer ${token}` };

    const res = await request(app)
      .post('/api/rooms')
      .set(auth)
      .send({ slug: 'jogos', name: 'Jogos' });
    expect(res.status).toBe(201);
    expect(
      (await request(app).post('/api/rooms').set(auth).send({ slug: 'jogos', name: 'Outra' }))
        .status,
    ).toBe(409);

    await Message.create({ room: 'jogos', user: user.id, username: 'ana', content: 'oi' });
    const list = await request(app).get('/api/rooms').set(auth);
    expect(list.body).toEqual([
      expect.objectContaining({ slug: 'jogos', messageCount: 1, onlineCount: 0 }),
    ]);
  });

  it('pagina o histórico por cursor em ordem cronológica', async () => {
    const { token, user } = await createUser('ana');
    const auth = { Authorization: `Bearer ${token}` };
    await createRoom();
    for (let i = 1; i <= 5; i += 1) {
      await Message.create({ room: 'geral', user: user.id, username: 'ana', content: `msg ${i}` });
    }

    const p1 = await request(app).get('/api/rooms/geral/messages?limit=2').set(auth);
    expect(p1.body.data.map((m) => m.content)).toEqual(['msg 4', 'msg 5']);
    expect(p1.body.hasMore).toBe(true);

    const p2 = await request(app)
      .get(`/api/rooms/geral/messages?limit=2&before=${p1.body.nextCursor}`)
      .set(auth);
    expect(p2.body.data.map((m) => m.content)).toEqual(['msg 2', 'msg 3']);

    const p3 = await request(app)
      .get(`/api/rooms/geral/messages?limit=2&before=${p2.body.nextCursor}`)
      .set(auth);
    expect(p3.body).toMatchObject({ hasMore: false, nextCursor: null });
    expect(p3.body.data.map((m) => m.content)).toEqual(['msg 1']);
  });

  it('retorna 404 para sala inexistente', async () => {
    const { token } = await createUser('ana');
    const res = await request(app)
      .get('/api/rooms/nada/messages')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('Cliente web e infraestrutura', () => {
  it('serve o cliente web e o health check', async () => {
    const page = await request(app).get('/');
    expect(page.status).toBe(200);
    expect(page.text).toContain('Chat Realtime');
    expect((await request(app).get('/health')).body.status).toBe('ok');
  });
});
