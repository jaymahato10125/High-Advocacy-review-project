import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';
import { authRouter } from './routes/auth.js';
import { submissionsRouter } from './routes/submissions.js';
import { notificationsRouter } from './routes/notifications.js';
import { BulkTooLargeError, HttpError } from './lib/errors.js';
import { logger } from './lib/logger.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // API (:4000) and web (:5173) are different origins but the same site, so
  // sameSite:'lax' cookies are still sent — but the browser enforces CORS
  // separately. Both this and `credentials: 'include'` on every frontend
  // fetch are required; getting only one right is the classic "login silently
  // doesn't work" bug in this exact setup.
  app.use(
    cors({
      origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
      credentials: true,
    }),
  );
  app.use(compression());
  // Oversized bodies get a clean 413; malformed JSON a clean 400 — not a crash.
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter);
  app.use('/api/submissions', submissionsRouter);
  app.use('/api/notifications', notificationsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { message: 'Not found' } });
  });

  // Single error boundary. Express 5 forwards rejected promises from async
  // route handlers here natively — no try/catch boilerplate in routes.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.statusCode).json({ error: { message: err.message, issues: err.details } });
      return;
    }
    if (err instanceof BulkTooLargeError) {
      res.status(422).json({ error: { message: err.message, maxRows: err.maxRows } });
      return;
    }
    if (err instanceof ZodError) {
      res.status(400).json({ error: { message: 'Validation failed', issues: err.flatten().fieldErrors } });
      return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
      // Malformed JSON body
      res.status(400).json({ error: { message: 'Malformed JSON body' } });
      return;
    }
    if (err instanceof Error && err.name === 'PayloadTooLargeError') {
      res.status(413).json({ error: { message: 'Payload too large' } });
      return;
    }
    logger.error({ err }, 'unhandled error');
    res.status(500).json({ error: { message: 'Internal server error' } });
  });

  return app;
}
