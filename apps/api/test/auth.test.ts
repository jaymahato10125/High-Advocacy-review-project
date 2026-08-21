import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/index.js';
import { loginAs, makeSubmission, resetTables, seedRows } from './helpers.js';

// Test 2 (implementation plan §11): authorization is enforced server-side.
const app = createApp();

afterAll(async () => {
  await pool.end();
});

describe('authorization', () => {
  beforeEach(resetTables);

  it('viewer ?status=pending is overridden to approved, not refused', async () => {
    const viewer = await loginAs(app, 'viewer');
    await seedRows([
      makeSubmission({ status: 'pending' }),
      makeSubmission({ status: 'pending' }),
      makeSubmission({ status: 'approved' }),
    ]);

    const res = await viewer.get('/api/submissions').query({ status: 'pending' }).expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data.every((s: { status: string }) => s.status === 'approved')).toBe(true);
  });

  it('viewer gets 403 on reviewer-only endpoints', async () => {
    const viewer = await loginAs(app, 'viewer');
    const ids = await seedRows([makeSubmission({ status: 'pending' })]);

    await viewer.patch(`/api/submissions/${ids[0]}/status`).send({ status: 'approved' }).expect(403);
    await viewer
      .post('/api/submissions/bulk-status')
      .send({ status: 'approved', mode: 'filter', filter: {} })
      .expect(403);
    await viewer.get('/api/notifications').expect(403);
  });

  it('viewer gets 404 (not 403) for a non-approved submission detail', async () => {
    const viewer = await loginAs(app, 'viewer');
    const ids = await seedRows([
      makeSubmission({ status: 'pending' }),
      makeSubmission({ status: 'approved' }),
    ]);

    await viewer.get(`/api/submissions/${ids[0]}`).expect(404);
    const ok = await viewer.get(`/api/submissions/${ids[1]}`).expect(200);
    expect(ok.body.status).toBe('approved');
  });

  it('no cookie on a protected route returns 401', async () => {
    await request(app).get('/api/submissions').expect(401);
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/notifications').expect(401);
  });

  it('a tampered cookie returns 401', async () => {
    await request(app)
      .get('/api/submissions')
      .set('Cookie', 'pd_session=eyJmb28iOiJiYXIifQ.forged.signature')
      .expect(401);
  });

  it('a cookie reused after logout returns 401', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ role: 'reviewer' }).expect(200);
    await agent.get('/api/auth/me').expect(200);
    await agent.post('/api/auth/logout').expect(204);
    // Same cookie jar, same token — but the session was revoked server-side.
    await agent.get('/api/auth/me').expect(401);
  });

  it('login rejects an unknown role', async () => {
    await request(app).post('/api/auth/login').send({ role: 'admin' }).expect(400);
  });
});
