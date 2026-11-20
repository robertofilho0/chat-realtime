import type { User } from '../generated/prisma/client.js';

export const toPublicUser = ({ passwordHash: _hash, ...user }: User) => user;
