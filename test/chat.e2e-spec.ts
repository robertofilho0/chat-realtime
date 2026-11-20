import type { INestApplication } from '@nestjs/common';
import {
  connected,
  createApp,
  emit,
  once,
  resetDb,
  sleep,
} from './helpers/app.js';

let ctx: Awaited<ReturnType<typeof createApp>>;
let app: INestApplication;
let ana: { token: string; auth: Record<string, string> };
let bruno: { token: string; auth: Record<string, string> };

const http = () => ctx.http();

async function cadastrar(username: string) {
  const { body } = await http()
    .post('/api/auth/register')
    .send({ username, password: 'Senha123' })
    .expect(201);
  return {
    token: body.token as string,
    auth: { Authorization: `Bearer ${body.token}` },
  };
}

beforeAll(async () => {
  ctx = await createApp();
  app = ctx.app;
});
beforeEach(async () => {
  await resetDb(app);
  ana = await cadastrar('ana');
  bruno = await cadastrar('bruno');
});
afterEach(() => ctx.disconnectAll());
afterAll(() => app.close());

describe('REST', () => {
  it('cadastra, faz login e consulta o perfil sem expor a senha', async () => {
    const reg = await http()
      .post('/api/auth/register')
      .send({ username: 'Roberto', password: 'Senha123' })
      .expect(201);
    expect(reg.body.user).toMatchObject({ username: 'roberto' });
    expect(reg.body.user.passwordHash).toBeUndefined();

    await http()
      .post('/api/auth/register')
      .send({ username: 'roberto', password: 'Senha123' })
      .expect(409);
    await http()
      .post('/api/auth/register')
      .send({ username: 'bia', password: '123' })
      .expect(400);
    await http()
      .post('/api/auth/login')
      .send({ username: 'roberto', password: 'Errada123' })
      .expect(401);

    const { body } = await http()
      .post('/api/auth/login')
      .send({ username: 'roberto', password: 'Senha123' })
      .expect(200);
    expect(
      (
        await http()
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${body.token}`)
      ).body.username,
    ).toBe('roberto');
  });

  it('lista as salas padrão e cria novas', async () => {
    await http().get('/api/rooms').expect(401);
    const salas = await http().get('/api/rooms').set(ana.auth).expect(200);
    expect(salas.body.map((s: { slug: string }) => s.slug)).toEqual([
      'geral',
      'dev',
    ]);

    await http()
      .post('/api/rooms')
      .set(ana.auth)
      .send({ slug: 'jogos', name: 'Jogos' })
      .expect(201);
    await http()
      .post('/api/rooms')
      .set(ana.auth)
      .send({ slug: 'jogos', name: 'Outra' })
      .expect(409);
  });

  it('pagina o histórico por cursor em ordem cronológica', async () => {
    const socket = ctx.connect(ana.token);
    await connected(socket);
    await emit(socket, 'room:join', 'geral');
    for (let i = 1; i <= 5; i += 1) {
      await emit(socket, 'message:send', {
        room: 'geral',
        content: `msg ${i}`,
      });
      await sleep(1100 / 5); // respeita o anti-flood (5 mensagens a cada 5s)
    }

    const conteudo = (r: { body: { data: { content: string }[] } }) =>
      r.body.data.map((m) => m.content);
    const p1 = await http()
      .get('/api/rooms/geral/messages?limit=2')
      .set(ana.auth)
      .expect(200);
    expect(conteudo(p1)).toEqual(['msg 4', 'msg 5']);
    const p2 = await http()
      .get(`/api/rooms/geral/messages?limit=2&before=${p1.body.nextCursor}`)
      .set(ana.auth);
    expect(conteudo(p2)).toEqual(['msg 2', 'msg 3']);
    const p3 = await http()
      .get(`/api/rooms/geral/messages?limit=2&before=${p2.body.nextCursor}`)
      .set(ana.auth);
    expect(p3.body).toMatchObject({ hasMore: false, nextCursor: null });

    await http().get('/api/rooms/nada/messages').set(ana.auth).expect(404);
  });

  it('serve o cliente web, o health check e a documentação', async () => {
    expect((await http().get('/').expect(200)).text).toContain('Chat Realtime');
    expect((await http().get('/api/health').expect(200)).body.database).toBe(
      'up',
    );
    await http().get('/docs').expect(200);
  });
});

describe('Socket.IO', () => {
  it('recusa conexão sem token válido', async () => {
    await expect(connected(ctx.connect('token-falso'))).rejects.toThrow(
      'Não autorizado',
    );
  });

  it('envia a lista de online e avisa quando alguém entra', async () => {
    const a = ctx.connect(ana.token);
    expect(await once(a, 'presence:list')).toEqual(['ana']);

    const online = once(a, 'user:online');
    const b = ctx.connect(bruno.token);
    const listaDoBruno = once(b, 'presence:list');
    expect(await online).toBe('bruno');
    expect(await listaDoBruno).toEqual(['ana', 'bruno']);
  });

  it('só avisa offline quando o usuário fecha a última aba', async () => {
    const a = ctx.connect(ana.token);
    const b1 = ctx.connect(bruno.token);
    const b2 = ctx.connect(bruno.token);
    await Promise.all([connected(a), connected(b1), connected(b2)]);

    let offline = false;
    a.on('user:offline', () => {
      offline = true;
    });
    b1.disconnect();
    await sleep(200);
    expect(offline).toBe(false);

    const evento = once(a, 'user:offline');
    b2.disconnect();
    expect(await evento).toBe('bruno');
  });

  it('entrega mensagens da sala e usa o usuário do token', async () => {
    const a = ctx.connect(ana.token);
    const b = ctx.connect(bruno.token);
    await Promise.all([connected(a), connected(b)]);

    expect(await emit(a, 'room:join', 'geral')).toMatchObject({ ok: true });
    expect((await emit(b, 'room:join', 'geral')).users).toEqual([
      'ana',
      'bruno',
    ]);

    const recebida = once(b, 'message:new');
    const ack = await emit<{ ok: boolean; message: { username: string } }>(
      a,
      'message:send',
      {
        room: 'geral',
        content: '  Olá, mundo!  ',
        username: 'bruno',
      },
    );
    expect(ack.ok).toBe(true);
    expect(ack.message.username).toBe('ana');
    expect(await recebida).toMatchObject({
      room: 'geral',
      username: 'ana',
      content: 'Olá, mundo!',
    });
  });

  it('exige entrar na sala e valida o conteúdo', async () => {
    const a = ctx.connect(ana.token);
    await connected(a);

    expect(
      await emit(a, 'message:send', { room: 'geral', content: 'oi' }),
    ).toMatchObject({ ok: false });
    expect(await emit(a, 'room:join', 'inexistente')).toEqual({
      ok: false,
      error: 'Sala não encontrada',
    });

    await emit(a, 'room:join', 'geral');
    expect(
      await emit(a, 'message:send', { room: 'geral', content: '   ' }),
    ).toMatchObject({ ok: false });
    expect(
      await emit(a, 'message:send', {
        room: 'geral',
        content: 'x'.repeat(2001),
      }),
    ).toMatchObject({ ok: false });
  });

  it('não vaza mensagens entre salas', async () => {
    const a = ctx.connect(ana.token);
    const b = ctx.connect(bruno.token);
    await Promise.all([connected(a), connected(b)]);
    await emit(a, 'room:join', 'dev');
    await emit(b, 'room:join', 'geral');

    let vazou = false;
    b.on('message:new', () => {
      vazou = true;
    });
    await emit(a, 'message:send', { room: 'dev', content: 'só na dev' });
    await sleep(200);
    expect(vazou).toBe(false);
  });

  it('limita mensagens em sequência (anti-flood)', async () => {
    const a = ctx.connect(ana.token);
    await connected(a);
    await emit(a, 'room:join', 'geral');

    const results: { ok: boolean; error?: string }[] = [];
    for (let i = 0; i < 7; i += 1)
      results.push(
        await emit(a, 'message:send', { room: 'geral', content: `m${i}` }),
      );
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results.at(-1)?.error).toMatch(/rápido demais/);
  });

  it('repassa o indicador de digitação para os outros da sala', async () => {
    const a = ctx.connect(ana.token);
    const b = ctx.connect(bruno.token);
    await Promise.all([connected(a), connected(b)]);
    await emit(a, 'room:join', 'geral');
    await emit(b, 'room:join', 'geral');

    const evento = once(b, 'typing');
    a.emit('typing', { room: 'geral', typing: true });
    expect(await evento).toEqual({
      room: 'geral',
      username: 'ana',
      typing: true,
    });
  });

  it('atualiza a contagem de online por sala na API', async () => {
    const a = ctx.connect(ana.token);
    await connected(a);
    await emit(a, 'room:join', 'geral');
    const salas = await http().get('/api/rooms').set(ana.auth);
    expect(
      salas.body.find((s: { slug: string }) => s.slug === 'geral'),
    ).toMatchObject({ onlineCount: 1 });
  });
});
