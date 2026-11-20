import http from 'node:http';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import app from '../../src/app.js';
import createSocketServer from '../../src/realtime/socket.js';
import presence from '../../src/realtime/presence.js';
import Room from '../../src/models/Room.js';

export async function startServer() {
  const server = http.createServer(app);
  const io = createSocketServer(server);
  await new Promise((resolve) => server.listen(0, resolve));
  const url = `http://localhost:${server.address().port}`;
  const clients = [];

  return {
    url,
    connect(token) {
      const socket = ioClient(url, { auth: { token }, transports: ['websocket'], forceNew: true });
      clients.push(socket);
      return socket;
    },
    async close() {
      clients.forEach((c) => c.disconnect());
      io.close();
      await new Promise((resolve) => server.close(resolve));
      presence.reset();
    },
  };
}

export async function createUser(username, password = 'Senha123') {
  const res = await request(app).post('/api/auth/register').send({ username, password });
  return { token: res.body.token, user: res.body.user };
}

export const createRoom = (slug = 'geral', name = 'Geral') => Room.create({ slug, name });

/** Espera um evento do socket (com timeout para o teste não travar). */
export const once = (socket, event, timeout = 3000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout esperando "${event}"`)), timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

/** Emite e aguarda o ack do servidor. */
export const emit = (socket, event, ...args) =>
  new Promise((resolve) => socket.emit(event, ...args, resolve));

export const connected = (socket) =>
  new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
