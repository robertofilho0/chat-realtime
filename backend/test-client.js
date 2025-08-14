import { io } from "socket.io-client";

const socket = io("http://localhost:5000"); // URL do servidor

// Quando conectar
socket.on("connect", () => {
  console.log("Conectado ao servidor! ID:", socket.id);

  // Envia uma mensagem
  socket.emit("send_message", {
    username: "Roberto",
    content: "Olá, mundo!",
    room: "global"
  });
});

// Recebe mensagens
socket.on("receive_message", (msg) => {
  console.log("Nova mensagem recebida:", msg);
});
