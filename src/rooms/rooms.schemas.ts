import { z } from 'zod';

export const roomSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{2,30}$/, 'Sala inválida');

export const createRoomSchema = z
  .object({
    slug: roomSlugSchema,
    name: z.string().trim().min(2).max(40),
    description: z.string().trim().max(200).optional(),
  })
  .strict();

export const historySchema = z.object({
  before: z.uuid('Cursor inválido').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const messageContentSchema = z
  .string()
  .trim()
  .min(1, 'A mensagem não pode ser vazia')
  .max(2000, 'A mensagem pode ter no máximo 2000 caracteres');

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type HistoryQuery = z.infer<typeof historySchema>;
