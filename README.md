# 💬 Chat Realtime

[![CI](https://github.com/robertofilho0/chat-realtime/actions/workflows/ci.yml/badge.svg)](https://github.com/robertofilho0/chat-realtime/actions/workflows/ci.yml)
![NestJS](https://img.shields.io/badge/nestjs-12-E0234E?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-6-3178C6?logo=typescript&logoColor=white)
![Socket.IO](https://img.shields.io/badge/socket.io-4-010101?logo=socket.io)
![PostgreSQL](https://img.shields.io/badge/postgresql-17-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/prisma-7-2D3748?logo=prisma&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

Chat em tempo real com **NestJS WebSocket Gateway (Socket.IO) autenticado por JWT**, salas, presença online, indicador de digitação, anti-flood e histórico paginado no **PostgreSQL/Prisma**. Inclui um **cliente web** leve (HTML, CSS e JS) servido pelo próprio backend.

## ✨ Funcionalidades

- **Autenticação no handshake do socket**: o autor de cada mensagem vem do token, então ninguém consegue se passar por outra pessoa
- **Salas** criadas via API, com entrada e saída em tempo real e lista de quem está em cada uma
- **Presença online multi-aba**: o usuário só fica offline ao fechar a última conexão
- **"Digitando…"** por sala e **anti-flood** configurável por conexão
- **Acks** em todos os eventos (`{ ok, … }` ou `{ ok: false, error }`)
- **Histórico paginado por cursor** (`?before=<id>`), eficiente mesmo com muitas mensagens
- Guards do Nest aplicados só ao HTTP (o WebSocket tem autenticação e rate limit próprios)
- Validação com **Zod** (nativa no Nest 12), Swagger, Helmet, CORS e health check
- **Testes e2e com clientes Socket.IO reais** conectando ao servidor e PostgreSQL de verdade

## 🧱 Stack

NestJS 12 · TypeScript · `@nestjs/websockets` + Socket.IO 4 · PostgreSQL 17 · Prisma 7 · JWT · Zod · Vitest · Supertest · Docker

## 📁 Estrutura

```
public/                     # cliente web (index.html, app.js, style.css)
src/
├── auth/                   # cadastro, login, me e guard global de JWT (HTTP)
├── chat/
│   ├── chat.gateway.ts     # autenticação do handshake, salas, mensagens, digitação e anti-flood
│   └── presence.service.ts # presença multi-aba
├── rooms/                  # API de salas e histórico
├── common/                 # validação, filtros e throttler só para HTTP
├── prisma/ config/ health/
prisma/schema.prisma + migrations/
test/                       # e2e com Socket.IO e PostgreSQL
```

## 🚀 Como rodar

```bash
git clone https://github.com/robertofilho0/chat-realtime.git
cd chat-realtime
docker compose up --build
```

Abra `http://localhost:5000`, crie uma conta e converse. Para ver o tempo real, abra uma janela anônima com outro usuário. As salas `geral` e `dev` são criadas automaticamente. O Swagger fica em `http://localhost:5000/docs`.

Localmente: `npm install`, `cp .env.example .env`, `npx prisma migrate deploy` e `npm run start:dev`.

## 📚 API REST

| Método | Rota                          | Auth   | Descrição                             |
| ------ | ----------------------------- | ------ | ------------------------------------- |
| `POST` | `/api/auth/register`          | —      | Cadastro                              |
| `POST` | `/api/auth/login`             | —      | Login                                 |
| `GET`  | `/api/auth/me`                | Bearer | Usuário autenticado                   |
| `GET`  | `/api/rooms`                  | Bearer | Salas com total de mensagens e online |
| `POST` | `/api/rooms`                  | Bearer | Cria sala                             |
| `GET`  | `/api/rooms/:slug/messages`   | Bearer | Histórico (`?before=<id>&limit=30`)   |

## ⚡ Eventos Socket.IO

```js
const socket = io('http://localhost:5000', { auth: { token } });

socket.emit('room:join', 'geral', (res) => console.log(res.users));
socket.emit('message:send', { room: 'geral', content: 'Olá!' }, (res) => {
  if (!res.ok) console.error(res.error);
});
socket.on('message:new', (msg) => console.log(`${msg.username}: ${msg.content}`));
```

| Direção            | Evento                         | Payload                       |
| ------------------ | ------------------------------ | ----------------------------- |
| cliente → servidor | `room:join` / `room:leave`     | `"geral"` (com ack)           |
| cliente → servidor | `message:send`                 | `{ room, content }` (com ack) |
| cliente → servidor | `typing`                       | `{ room, typing }`            |
| servidor → cliente | `message:new`                  | mensagem salva                |
| servidor → cliente | `room:users`                   | `{ room, users }`             |
| servidor → cliente | `presence:list`                | usuários online               |
| servidor → cliente | `user:online` / `user:offline` | username                      |
| servidor → cliente | `typing`                       | `{ room, username, typing }`  |

## 🧪 Testes

```bash
npm test             # unitários
npm run test:e2e     # e2e com clientes Socket.IO reais (requer DATABASE_URL)
npm run lint
```

## 📄 Licença

MIT. Veja [LICENSE](LICENSE).

---

Feito por [Roberto Filho](https://github.com/robertofilho0) · [LinkedIn](https://www.linkedin.com/in/roberto-filho-393b372b2/)
