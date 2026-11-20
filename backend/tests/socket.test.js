import * as db from './helpers/db.js';
import { startServer, createUser, createRoom, once, emit, connected } from './helpers/server.js';

let srv;
let ana;
let bruno;

beforeAll(db.connect);
afterAll(db.close);

beforeEach(async () => {
  srv = await startServer();
  ana = await createUser('ana');
  bruno = await createUser('bruno');
  await createRoom();
});

afterEach(async () => {
  await srv.close();
  await db.clear();
});

describe('Conexão', () => {
  it('recusa conexão sem token válido', async () => {
    await expect(connected(srv.connect('token-falso'))).rejects.toThrow('Não autorizado');
  });

  it('envia a lista de usuários online e avisa quando alguém entra', async () => {
    const a = srv.connect(ana.token);
    expect(await once(a, 'presence:list')).toEqual(['ana']);

    const online = once(a, 'user:online');
    const b = srv.connect(bruno.token);
    const listaDoBruno = once(b, 'presence:list');
    expect(await online).toBe('bruno');
    expect(await listaDoBruno).toEqual(['ana', 'bruno']);
  });

  it('avisa quando o usuário fica offline (considerando várias abas)', async () => {
    const a = srv.connect(ana.token);
    await connected(a);
    const b1 = srv.connect(bruno.token);
    const b2 = srv.connect(bruno.token);
    await Promise.all([connected(b1), connected(b2)]);

    let offline = false;
    a.on('user:offline', () => {
      offline = true;
    });
    b1.disconnect();
    await new Promise((r) => setTimeout(r, 200));
    expect(offline).toBe(false); // ainda há uma aba aberta

    const evento = once(a, 'user:offline');
    b2.disconnect();
    expect(await evento).toBe('bruno');
  });
});

describe('Mensagens', () => {
  it('entrega mensagens da sala para todos os participantes', async () => {
    const a = srv.connect(ana.token);
    const b = srv.connect(bruno.token);
    await Promise.all([connected(a), connected(b)]);

    expect(await emit(a, 'room:join', 'geral')).toMatchObject({ ok: true });
    expect((await emit(b, 'room:join', 'geral')).users).toEqual(['ana', 'bruno']);

    const recebida = once(b, 'message:new');
    const ack = await emit(a, 'message:send', { room: 'geral', content: '  Olá, mundo!  ' });

    expect(ack.ok).toBe(true);
    expect(await recebida).toMatchObject({
      room: 'geral',
      username: 'ana',
      content: 'Olá, mundo!',
    });
  });

  it('usa o usuário do token, ignorando o username enviado pelo cliente', async () => {
    const a = srv.connect(ana.token);
    await connected(a);
    await emit(a, 'room:join', 'geral');
    const ack = await emit(a, 'message:send', { room: 'geral', content: 'oi', username: 'bruno' });
    expect(ack.message.username).toBe('ana');
  });

  it('exige entrar na sala e valida o conteúdo', async () => {
    const a = srv.connect(ana.token);
    await connected(a);

    expect(await emit(a, 'message:send', { room: 'geral', content: 'oi' })).toMatchObject({
      ok: false,
    });
    expect(await emit(a, 'room:join', 'inexistente')).toEqual({
      ok: false,
      error: 'Sala não encontrada',
    });

    await emit(a, 'room:join', 'geral');
    expect(await emit(a, 'message:send', { room: 'geral', content: '   ' })).toMatchObject({
      ok: false,
    });
    expect(
      await emit(a, 'message:send', { room: 'geral', content: 'x'.repeat(2001) }),
    ).toMatchObject({ ok: false });
  });

  it('não entrega mensagens de outras salas', async () => {
    const { default: Room } = await import('../src/models/Room.js');
    await Room.create({ slug: 'dev', name: 'Dev' });
    const a = srv.connect(ana.token);
    const b = srv.connect(bruno.token);
    await Promise.all([connected(a), connected(b)]);
    await emit(a, 'room:join', 'dev');
    await emit(b, 'room:join', 'geral');

    let vazou = false;
    b.on('message:new', () => {
      vazou = true;
    });
    await emit(a, 'message:send', { room: 'dev', content: 'só na dev' });
    await new Promise((r) => setTimeout(r, 200));
    expect(vazou).toBe(false);
  });

  it('limita mensagens em sequência (anti-flood)', async () => {
    const a = srv.connect(ana.token);
    await connected(a);
    await emit(a, 'room:join', 'geral');

    const results = [];
    for (let i = 0; i < 7; i += 1)
      results.push(await emit(a, 'message:send', { room: 'geral', content: `m${i}` }));

    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results.at(-1).error).toMatch(/rápido demais/);
  });

  it('repassa o indicador de digitação para os outros da sala', async () => {
    const a = srv.connect(ana.token);
    const b = srv.connect(bruno.token);
    await Promise.all([connected(a), connected(b)]);
    await emit(a, 'room:join', 'geral');
    await emit(b, 'room:join', 'geral');

    const evento = once(b, 'typing');
    a.emit('typing', { room: 'geral', typing: true });
    expect(await evento).toEqual({ room: 'geral', username: 'ana', typing: true });
  });

  it('persiste as mensagens no histórico', async () => {
    const a = srv.connect(ana.token);
    await connected(a);
    await emit(a, 'room:join', 'geral');
    await emit(a, 'message:send', { room: 'geral', content: 'fica salvo' });

    const { default: Message } = await import('../src/models/Message.js');
    expect(await Message.countDocuments({ room: 'geral', content: 'fica salvo' })).toBe(1);
  });
});
