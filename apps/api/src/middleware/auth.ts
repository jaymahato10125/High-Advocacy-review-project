import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Sessions & authorization (implementation plan §4). No password, no signup —
// but the role check has to survive someone hitting the API directly, which is
// explicitly how it's tested. A stateless signed cookie (JWT) can't be forged
// by editing a header, and the httpOnly flag keeps it out of JS reach.
// ---------------------------------------------------------------------------

export type Role = 'reviewer' | 'viewer';

export interface AuthContext {
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

export const SESSION_COOKIE = 'pd_session';
const SESSION_TTL_SECONDS = 12 * 60 * 60;

export function sessionSecret(): string {
  return process.env.SESSION_SECRET ?? 'dev-only-secret-change-me';
}

// Logout invalidation: JWTs are stateless, so "cookie reused after logout"
// only 401s if the server remembers what it killed. We keep an in-memory set
// of revoked token ids (jti). Honest limitation, documented in the README: the
// set doesn't survive a server restart (fine for a demo tool; a real
// deployment would move this to Redis or shorten token TTL + refresh).
const revokedJtis = new Set<string>();

const isProd = process.env.NODE_ENV === 'production';

export function issueSession(res: Response, role: Role): void {
  const token = jwt.sign({ role }, sessionSecret(), {
    expiresIn: SESSION_TTL_SECONDS,
    jwtid: crypto.randomUUID(),
  });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: '/',
  });
}

export function clearSession(req: Request, res: Response): void {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === 'string') {
    try {
      const payload = jwt.verify(token, sessionSecret()) as jwt.JwtPayload;
      if (payload.jti) revokedJtis.add(payload.jti);
    } catch {
      // Already invalid/expired — nothing to revoke.
    }
  }
  res.clearCookie(SESSION_COOKIE, {
    path: '/',
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
  });
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    res.status(401).json({ error: { message: 'Not authenticated' } });
    return;
  }
  try {
    const payload = jwt.verify(token, sessionSecret()) as jwt.JwtPayload;
    if (payload.jti && revokedJtis.has(payload.jti)) {
      res.status(401).json({ error: { message: 'Session has been revoked' } });
      return;
    }
    if (payload.role !== 'reviewer' && payload.role !== 'viewer') {
      res.status(401).json({ error: { message: 'Invalid session' } });
      return;
    }
    req.auth = { role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: { message: 'Not authenticated' } });
  }
}

export function requireReviewer(req: Request, res: Response, next: NextFunction): void {
  if (req.auth?.role !== 'reviewer') {
    res.status(403).json({ error: { message: 'Reviewer role required' } });
    return;
  }
  next();
}
