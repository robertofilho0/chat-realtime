import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
  username: { type: String, required: true },
  content: { type: String, required: true },
  room: { type: String, default: "global" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Message", MessageSchema);
