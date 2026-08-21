import { Router } from 'express';
import { loginSchema } from '@proofdesk/shared';
import { authenticate, clearSession, issueSession } from '../middleware/auth.js';

// ---------------------------------------------------------------------------
// Auth (implementation plan §4). Two fixed users, no password — "a simple way
// to switch between them". The role lives in a signed httpOnly cookie.
// ---------------------------------------------------------------------------

const DISPLAY_NAMES = { reviewer: 'Reviewer', viewer: 'Viewer' } as const;

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { message: 'role must be "reviewer" or "viewer"', issues: parsed.error.flatten() },
    });
    return;
  }
  const role = parsed.data.role;
  issueSession(res, role);
  res.json({ role, displayName: DISPLAY_NAMES[role] });
});

authRouter.post('/logout', authenticate, (req, res) => {
  clearSession(req, res);
  res.status(204).end();
});

authRouter.get('/me', authenticate, (req, res) => {
  const role = req.auth!.role;
  res.json({ role, displayName: DISPLAY_NAMES[role] });
});
