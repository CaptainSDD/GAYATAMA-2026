import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Env } from './config/env';

/** HTTP settings shared by the server and the end-to-end tests. */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.setGlobalPrefix('api/v1');
  app.disable('x-powered-by');
  // Behind Cloud Run the client IP arrives in X-Forwarded-For. Without trusting
  // the proxy, every visitor would share one rate-limit bucket.
  app.set('trust proxy', config.get('TRUST_PROXY_HOPS', { infer: true }));
  app.enableCors({
    origin: config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ''),
  });
  app.enableShutdownHooks();
}
