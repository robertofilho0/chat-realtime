# 📝 Chat Realtime - Node.js + Express + MongoDB + React

> Aplicação de chat em tempo real.  
> Desenvolvida com **Node.js**, **Express**, **MongoDB** e **React**.

---

## 🛠 Tecnologias Utilizadas

- **Backend:** Node.js, Express, MongoDB, Mongoose, Socket.IO, JWT  
- **Frontend:** React, Axios, Socket.IO Client  
- **Autenticação:** JWT (JSON Web Tokens)  
- **Ferramentas:** Nodemon, Postman, Git/GitHub  9

---
## 📌 Ajustes e melhorias

O projeto ainda está em desenvolvimento e as próximas atualizações serão voltadas para as seguintes tarefas:

- [x] CRUD de usuários (registro/login com JWT)
- [x] Envio de mensagens em tempo real
- [x] Histórico de mensagens no MongoDB
- [ ] Múltiplas salas de chat avançadas
- [ ] Status online/offline dos usuários
- [ ] Envio de imagens e arquivos
- [ ] Frontend com layout moderno (Tailwind/Material UI)
- [ ] Deploy do backend e frontend

---

## 💻 Pré-requisitos

Antes de começar, verifique se você atendeu aos seguintes requisitos:

- **Node.js** v16+ e **npm** instalados
- Uma conta no [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) ou instância local do MongoDB
- Compatível com **Windows**, **Linux** e **macOS**

---

## 🚀 Instalando Chat Realtime

**1. Clone o repositório:**
```bash
git clone https://github.com/RobertoTheDev/chat-realtime.git
cd chat-realtime
```

## Back-end

**2. Instale as dependências:**
```bash
npm install
```
**3. Configure o arquivo .env:**
```.env
PORT=5000
MONGO_URI=sua_connection_string_mongodb
JWT_SECRET=seusegredojw
```

**4. Execute a aplicação:**
```bash
npm run dev
```

- O backend rodará em http://localhost:5000

## Front-end

**5. Instale as dependências do frontend:**
```bash
cd ../frontend-react
npm install
```

**6. Execute a aplicação:**
```bash
npm start
```

- O frontend rodará em http://localhost:3000.

## ☕ Usando Chat Realtime:
**Exemplos curl:**

- Registrar usuário:
````bash 
curl -X POST http://localhost:5000/auth/register \
-H "Content-Type: application/json" \
-d '{"username":"teste","password":"123456"}'
````
- Listar tarefas:
````bash 
curl -X POST http://localhost:5000/auth/login \
-H "Content-Type: application/json" \
-d '{"username":"teste","password":"123456"}'
````

## Mensagens
- Enviar mensagem (via **Socket.IO** no frontend):

````javascript
socket.emit("send_message", { username: "teste", content: "Olá!", room: "global" });
````

- Listar histórico de mensagens:

````bash
curl http://localhost:5000/messages/global
````

## 🗂 Estrutura do projeto

````pgsql
chat-realtime/
├── backend/
│   ├── models/
│   │   └── User.js
│   │   └── Message.js
│   ├── routes/
│   │   └── auth.js
│   └── server.js
├── frontend-react/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat.js
│   │   │   └── Login.js
│   │   ├── api/
│   │   │   └── api.js
│   │   └── App.js
│   └── package.json
└── README.md

````