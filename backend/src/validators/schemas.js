import { z } from 'zod';

export const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, 'username deve ter 3 a 20 caracteres (letras, números ou _)');

export const roomSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{2,30}$/, 'Sala inválida');

export const register = z
  .object({
    username,
    displayName: z.string().trim().min(1).max(40).optional(),
    password: z
      .string()
      .min(8, 'A senha deve ter ao menos 8 caracteres')
      .regex(/[A-Za-z]/, 'A senha deve conter letras')
      .regex(/\d/, 'A senha deve conter números'),
  })
  .strict();

export const login = z.object({ username, password: z.string().min(1) }).strict();

export const createRoom = z
  .object({
    slug: roomSlug,
    name: z.string().trim().min(2).max(40),
    description: z.string().trim().max(200).optional(),
  })
  .strict();

export const roomParams = z.object({ slug: roomSlug });

export const history = z.object({
  before: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'Cursor inválido')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const messageContent = z
  .string()
  .trim()
  .min(1, 'A mensagem não pode ser vazia')
  .max(2000, 'A mensagem pode ter no máximo 2000 caracteres');
