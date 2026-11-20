# 💬 Chat Realtime

[![CI](https://github.com/robertofilho0/chat-realtime/actions/workflows/ci.yml/badge.svg)](https://github.com/robertofilho0/chat-realtime/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)
![Socket.IO](https://img.shields.io/badge/socket.io-4-010101?logo=socket.io)
![MongoDB](https://img.shields.io/badge/mongodb-7-47A248?logo=mongodb&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

Chat em tempo real com **Socket.IO autenticado por JWT**, salas, presença online, indicador de digitação, anti-flood e histórico paginado no MongoDB. Inclui um **cliente web** leve (HTML, CSS e JS puros) servido pelo próprio backend.

## ✨ Funcionalidades

- **Autenticação no handshake do socket**: o usuário vem do token, então ninguém consegue enviar mensagens se passando por outra pessoa
- **Salas**: criação via API, entrada e saída em tempo real, lista de quem está em cada sala
- **Presença online** que considera várias abas do mesmo usuário (só fica offline ao fechar a última)
- **Indicador de "digitando…"** por sala
- **Anti-flood**: limite de mensagens por conexão, configurável
- **Acks** em todos os eventos, com erros claros (`{ ok: false, error }`)
- **Histórico paginado por cursor** (`?before=<id>`), eficiente mesmo com muitas mensagens
- Validação com **Zod**, senhas com bcrypt, **Helmet**, **CORS**, **rate limiting** e health check
- **Swagger** em `/docs`, com a documentação dos eventos do socket
- **Testes** de REST e de **Socket.IO de ponta a ponta** (clientes reais conectando ao servidor)
- **Docker Compose** (API + MongoDB) e **CI** no GitHub Actions

## 🧱 Stack

Node.js 22+ (ESM) · Express 5 · Socket.IO 4 · MongoDB / Mongoose · JWT · Zod · Jest · Supertest · Docker

## 📁 Estrutura

```
chat-realtime/
├── docker-compose.yml
└── backend/
    ├── public/                 # cliente web (index.html, app.js, style.css)
    ├── src/
    │   ├── app.js / server.js
    │   ├── realtime/
    │   │   ├── socket.js       # autenticação, salas, mensagens, digitação e anti-flood
    │   │   └── presence.js     # controle de presença (multi-aba)
    │   ├── controllers/ routes/ models/ validators/ middlewares/
    │   └── docs/openapi.json
    └── tests/                  # REST, Socket.IO e presença
```

## 🚀 Como rodar

### Com Docker

```bash
git clone https://github.com/robertofilho0/chat-realtime.git
cd chat-realtime
docker compose up --build
```

Abra `http://localhost:5000`, crie uma conta e converse. Abra outra janela anônima com outro usuário para ver o tempo real funcionando. As salas `geral` e `dev` são criadas automaticamente.

### Localmente

```bash
cd backend
npm install
cp .env.example .env   # defina MONGO_URI e JWT_SECRET
npm run dev
```

## 📚 API REST

| Método | Rota                        | Auth   | Descrição                             |
| ------ | --------------------------- | ------ | ------------------------------------- |
| `POST` | `/api/auth/register`        | —      | Cadastro                              |
| `POST` | `/api/auth/login`           | —      | Login                                 |
| `GET`  | `/api/auth/me`              | Bearer | Usuário autenticado                   |
| `GET`  | `/api/rooms`                | Bearer | Salas com total de mensagens e online |
| `POST` | `/api/rooms`                | Bearer | Cria sala                             |
| `GET`  | `/api/rooms/:slug/messages` | Bearer | Histórico (`?before=<id>&limit=30`)   |

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
| servidor → cliente | `presence:list`                | lista de usuários online      |
| servidor → cliente | `user:online` / `user:offline` | username                      |
| servidor → cliente | `typing`                       | `{ room, username, typing }`  |

## 🧪 Testes

```bash
cd backend
npm test               # sobe um MongoDB em memória e clientes Socket.IO reais
npm run test:coverage
npm run lint
```

## 📄 Licença

MIT. Veja [LICENSE](LICENSE).

---

Feito por [Roberto Filho](https://github.com/robertofilho0) · [LinkedIn](https://www.linkedin.com/in/roberto-filho-393b372b2/)
