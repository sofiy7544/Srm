import { config } from './config/index.js';
import { Orchestrator } from './core/orchestrator.js';
import { createServer } from './server.js';
import { log } from './lib/logger.js';

async function main(): Promise<void> {
  const orchestrator = new Orchestrator();
  const app = createServer(orchestrator);

  const server = app.listen(config.PORT, () => {
    log.info(`Control server listening on http://localhost:${config.PORT}`);
    log.info('Endpoints: GET /health, GET /status, POST /start, POST /stop');
    if (config.DRY_RUN) log.warn('DRY_RUN is ON — no real SMS will be sent until you set DRY_RUN=false');
  });

  // Start the watcher pipeline immediately; failures here shouldn't kill the
  // control server (you can retry via POST /start after fixing login/selectors).
  try {
    await orchestrator.start();
  } catch (err) {
    log.error('Initial start failed — fix and POST /start to retry', String(err));
  }

  const shutdown = async (signal: string): Promise<void> => {
    log.info(`Received ${signal}, shutting down`);
    server.close();
    await orchestrator.stop().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
