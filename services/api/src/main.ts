import Fastify from 'fastify';
import { registerSecurity } from './plugins/security.js';
import { registerConsentRoutes } from './routes/consent.js';
import { registerHealthRoutes } from './routes/health.js';

const port = Number(process.env.PORT ?? process.env.APP_PORT ?? 8080);
const host = process.env.HOST ?? '0.0.0.0';

async function buildServer() {
  const app = Fastify({ logger: true });
  await registerSecurity(app);
  await registerHealthRoutes(app);
  await registerConsentRoutes(app);
  return app;
}

async function start() {
  const app = await buildServer();
  try {
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
