import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9_]{3,20}$/,
    'username deve ter 3 a 20 caracteres (letras, números ou _)',
  );

export const registerSchema = z
  .object({
    username: usernameSchema,
    displayName: z.string().trim().min(1).max(40).optional(),
    password: z
      .string()
      .min(8, 'A senha deve ter ao menos 8 caracteres')
      .regex(/[A-Za-z]/, 'A senha deve conter letras')
      .regex(/\d/, 'A senha deve conter números'),
  })
  .strict();

export const loginSchema = z
  .object({ username: usernameSchema, password: z.string().min(1) })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
