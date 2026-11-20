import mongoose from 'mongoose';
import toJSON from './toJSON.js';

const messageSchema = new mongoose.Schema(
  {
    room: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON },
);

messageSchema.index({ room: 1, _id: -1 });

export default mongoose.model('Message', messageSchema);
