import 'dotenv/config';
import { z } from 'zod';

const isTest = process.env.NODE_ENV === 'test';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGO_URI: z.string().min(1).default('mongodb://localhost:27017/chat-realtime'),
  CORS_ORIGIN: z.string().default('*'),
  JWT_SECRET: isTest
    ? z.string().default('test-secret-test-secret-test-secret')
    : z.string().min(32, 'JWT_SECRET deve ter ao menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  BCRYPT_ROUNDS: z.coerce
    .number()
    .int()
    .min(4)
    .max(15)
    .default(isTest ? 4 : 12),
  MESSAGE_RATE_LIMIT: z.coerce.number().int().positive().default(5),
  MESSAGE_RATE_WINDOW_MS: z.coerce.number().int().positive().default(5000),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:');
  parsed.error.issues.forEach((i) => console.error(`   - ${i.path.join('.')}: ${i.message}`));
  process.exit(1);
}

export default parsed.data;
