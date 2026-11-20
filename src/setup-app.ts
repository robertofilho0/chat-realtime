import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { validationPipe } from './common/validation.js';
import type { Env } from './config/env.js';

/** Configuração compartilhada entre o main.ts e os testes e2e. */
export function setupApp(app: INestApplication): INestApplication {
  const config = app.get(ConfigService<Env, true>);
  const origin = config.get('CORS_ORIGIN', { infer: true });

  app.setGlobalPrefix('api');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { 'connect-src': ["'self'", 'ws:', 'wss:'] },
      },
    }),
  );
  app.enableCors({ origin: origin === '*' ? '*' : origin.split(',') });
  app.useGlobalPipes(validationPipe());
  app.enableShutdownHooks();

  // Cliente web de demonstração (HTML/CSS/JS) servido na raiz
  (app as NestExpressApplication).useStaticAssets(
    join(import.meta.dirname, '..', 'public'),
  );

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Chat Realtime')
      .setDescription(
        'API REST do chat. Os eventos em tempo real (Socket.IO) estão documentados no README.',
      )
      .setVersion('3.0.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, document);

  return app;
}
