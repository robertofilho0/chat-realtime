import http from 'node:http';
import mongoose from 'mongoose';
import app from './app.js';
import env from './config/env.js';
import createSocketServer from './realtime/socket.js';
import Room from './models/Room.js';

const DEFAULT_ROOMS = [
  { slug: 'geral', name: 'Geral', description: 'Conversa livre' },
  { slug: 'dev', name: 'Dev', description: 'Programação e tecnologia' },
];

async function ensureDefaultRooms() {
  await Promise.all(
    DEFAULT_ROOMS.map((room) =>
      Room.updateOne({ slug: room.slug }, { $setOnInsert: room }, { upsert: true }),
    ),
  );
}

async function start() {
  await mongoose.connect(env.MONGO_URI);
  console.log('✅ Conectado ao MongoDB');
  await ensureDefaultRooms();

  const server = http.createServer(app);
  const io = createSocketServer(server);

  server.listen(env.PORT, () => {
    console.log(`🚀 Chat rodando em http://localhost:${env.PORT}`);
    console.log(`📚 Documentação em http://localhost:${env.PORT}/docs`);
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} recebido. Encerrando...`);
    io.close();
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('❌ Falha ao iniciar:', err);
  process.exit(1);
});
