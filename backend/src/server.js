import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import Message from "./models/Message.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Conexão MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado"))
  .catch(err => console.error("❌ Erro MongoDB:", err));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Lista de usuários online
let onlineUsers = {};

// Rota para pegar histórico de mensagens por sala
app.get("/messages/:room", async (req, res) => {
  const { room } = req.params;
  const messages = await Message.find({ room }).sort({ createdAt: 1 });
  res.json(messages);
});

// Rotas de autenticação
app.use("/auth", authRoutes);

// Socket.IO
io.on("connection", (socket) => {
  console.log(`🟢 Usuário conectado: ${socket.id}`);

  // Entrar em uma sala
  socket.on("join_room", (room) => {
    socket.join(room);
    console.log(`Usuário ${socket.id} entrou na sala ${room}`);
  });

  // Salvar e enviar mensagem
  socket.on("send_message", async (data) => {
    const message = await Message.create({
      username: data.username,
      content: data.content,
      room: data.room || "global"
    });

    io.to(data.room || "global").emit("receive_message", message);
  });

  // Login socket para status online
  socket.on("login", (username) => {
    onlineUsers[username] = socket.id;
    io.emit("online_users", Object.keys(onlineUsers));
  });

  // Desconectar
  socket.on("disconnect", () => {
    for (let user in onlineUsers) {
      if (onlineUsers[user] === socket.id) delete onlineUsers[user];
    }
    io.emit("online_users", Object.keys(onlineUsers));
    console.log(`🔴 Usuário desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
