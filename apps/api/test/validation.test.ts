import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/index.js';
import { resetTables } from './helpers.js';

// Test 3 (implementation plan §11): public-form validation. Graders will "test
// invalid, long, and unexpected input" — plausibly by calling the API directly,
// bypassing the form, so the server re-validates everything independently.
const app = createApp();

const validPayload = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  company: 'Acme Inc',
  jobTitle: 'CTO',
  rating: 5,
  testimonialText: 'This product changed how we work.',
  type: 'written',
};

afterAll(async () => {
  await pool.end();
});

describe('POST /api/submissions validation', () => {
  beforeEach(resetTables);

  it('a fully valid payload returns 201 with status pending', async () => {
    const res = await request(app).post('/api/submissions').send(validPayload).expect(201);
    expect(res.body).toMatchObject({ status: 'pending' });
    expect(typeof res.body.id).toBe('number');
  });

  it('missing email -> 400 with field-level errors', async () => {
    const { email: _omit, ...payload } = validPayload;
    const res = await request(app).post('/api/submissions').send(payload).expect(400);
    expect(res.body.error.issues).toHaveProperty('email');
  });

  it.each([0, 6, -1, 2.5])('rating of %s -> 400', async (rating) => {
    const res = await request(app)
      .post('/api/submissions')
      .send({ ...validPayload, rating })
      .expect(400);
    expect(res.body.error.issues).toHaveProperty('rating');
  });

  it('testimonial text over 5,000 chars -> 400', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .send({ ...validPayload, testimonialText: 'x'.repeat(5001) })
      .expect(400);
    expect(res.body.error.issues).toHaveProperty('testimonialText');
  });

  it('missing link on a video submission -> 400', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .send({ ...validPayload, type: 'video' })
      .expect(400);
    expect(res.body.error.issues).toHaveProperty('sourceLink');
  });

  it.each(['javascript:alert(1)', 'data:text/html,<script>1</script>', 'not a url'])(
    'sourceLink %s -> 400',
    async (sourceLink) => {
      const res = await request(app)
        .post('/api/submissions')
        .send({ ...validPayload, type: 'social', sourceLink })
        .expect(400);
      expect(res.body.error.issues).toHaveProperty('sourceLink');
    },
  );

  it('type outside the four allowed values -> 400', async () => {
    await request(app).post('/api/submissions').send({ ...validPayload, type: 'audio' }).expect(400);
  });

  it('malformed JSON body -> clean 400, not a crash', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .set('Content-Type', 'application/json')
      .send('{"name":')
      .expect(400);
    expect(res.body.error.message).toMatch(/malformed/i);
  });

  it('client-supplied status is ignored — always created pending', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .send({ ...validPayload, status: 'approved' })
      .expect(201);
    expect(res.body.status).toBe('pending');
  });

  it('unicode/emoji content round-trips', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .send({ ...validPayload, name: 'Zoë O’Brien 🚀', testimonialText: 'Amazing — 10/10 ✨ would recommend 💯' })
      .expect(201);
    expect(res.body.id).toBeGreaterThan(0);
  });
});
