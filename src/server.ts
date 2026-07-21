import express, { type Express } from 'express';
import type { Orchestrator } from './core/orchestrator.js';
import { log } from './lib/logger.js';

/**
 * Small control/observability API around the orchestrator. This is the
 * "Express + TypeScript" surface: health, live stats, and start/stop.
 */
export function createServer(orchestrator: Orchestrator): Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/status', (_req, res) => {
    res.json(orchestrator.stats);
  });

  app.post('/start', async (_req, res) => {
    try {
      await orchestrator.start();
      res.json({ ok: true, stats: orchestrator.stats });
    } catch (err) {
      log.error('start failed', String(err));
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.post('/stop', async (_req, res) => {
    try {
      await orchestrator.stop();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  return app;
}
