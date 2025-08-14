import express from "express";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const router = express.Router();
const SECRET = process.env.JWT_SECRET || "seusegredojwt";

// Registrar usuário
router.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = new User({ username, password });
    await user.save();
    res.json({ message: "Usuário registrado com sucesso" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ message: "Usuário não encontrado" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ message: "Senha incorreta" });

  const token = jwt.sign({ id: user._id }, SECRET, { expiresIn: "1d" });
  res.json({ user: { username: user.username }, token });
});

export default router;
