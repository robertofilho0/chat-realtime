import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io as ioClient, type Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { PresenceService } from '../../src/chat/presence.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { RoomsService } from '../../src/rooms/rooms.service.js';
import { setupApp } from '../../src/setup-app.js';

export async function createApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app: INestApplication = setupApp(moduleRef.createNestApplication());
  await app.listen(0);
  const { port } = app.getHttpServer().address();
  const url = `http://127.0.0.1:${port}`;
  const clients: Socket[] = [];

  return {
    app,
    prisma: app.get(PrismaService),
    http: () => request(app.getHttpServer()),
    connect(token: string) {
      const socket = ioClient(url, {
        auth: { token },
        transports: ['websocket'],
        forceNew: true,
      });
      clients.push(socket);
      return socket;
    },
    disconnectAll() {
      clients.splice(0).forEach((c) => c.disconnect());
    },
  };
}

/** Limpa o banco, a presença e recria as salas padrão. */
export async function resetDb(app: INestApplication) {
  await app
    .get(PrismaService)
    .$executeRawUnsafe('TRUNCATE TABLE "messages", "rooms", "users" CASCADE');
  app.get(PresenceService).reset();
  await app.get(RoomsService).ensureDefaultRooms();
}

export const once = <T = unknown>(
  socket: Socket,
  event: string,
  timeout = 3000,
) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout esperando "${event}"`)),
      timeout,
    );
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

export const emit = <T = Record<string, unknown>>(
  socket: Socket,
  event: string,
  ...args: unknown[]
) => new Promise<T>((resolve) => socket.emit(event, ...args, resolve));

export const connected = (socket: Socket) =>
  new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
