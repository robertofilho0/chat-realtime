import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import swaggerUi from 'swagger-ui-express';

import env from './config/env.js';
import routes from './routes/index.js';
import notFound from './middlewares/notFound.js';
import errorHandler from './middlewares/errorHandler.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const openapi = JSON.parse(readFileSync(path.join(dirname, 'docs/openapi.json'), 'utf8'));

const app = express();

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { 'connect-src': ["'self'", 'ws:', 'wss:'] },
    },
  }),
);
app.use(cors({ origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',') }));
app.use(express.json({ limit: '50kb' }));
if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
  }),
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'up' : 'down' });
});

app.use('/api', routes);

// Cliente web de demonstração
app.use(express.static(path.join(dirname, '..', 'public')));

app.use(notFound);
app.use(errorHandler);

export default app;
