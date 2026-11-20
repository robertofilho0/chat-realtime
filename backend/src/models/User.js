import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import env from '../config/env.js';
import toJSON from './toJSON.js';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    displayName: { type: String, trim: true, maxlength: 40 },
    password: { type: String, required: true, select: false },
    lastSeenAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      ...toJSON,
      transform: (doc, ret) => {
        toJSON.transform(doc, ret);
        delete ret.password;
        return ret;
      },
    },
  },
);

userSchema.pre('save', async function () {
  if (this.isModified('password'))
    this.password = await bcrypt.hash(this.password, env.BCRYPT_ROUNDS);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

export default mongoose.model('User', userSchema);
