import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/index.js';
import { loginAs, makeSubmission, resetTables, seedRows } from './helpers.js';

// Test 4 (implementation plan §11): filter/sort/pagination correctness against
// a small known seeded set — exact row order for each sort, and sane behavior
// past the last page.
const app = createApp();

afterAll(async () => {
  await pool.end();
});

describe('GET /api/submissions', () => {
  beforeEach(resetTables);

  async function seedKnownSet() {
    // Deliberately scrambled insert order; dates/names chosen for exact sorts.
    return seedRows([
      makeSubmission({
        name: 'Charlie',
        company: 'Beta Corp',
        rating: 3,
        status: 'pending',
        submittedAt: new Date(Date.UTC(2025, 2, 10)),
      }),
      makeSubmission({
        name: 'Alice',
        company: 'Acme',
        rating: 5,
        status: 'approved',
        submittedAt: new Date(Date.UTC(2025, 0, 5)),
      }),
      makeSubmission({
        name: 'Bob',
        company: 'G2 Crowd',
        rating: 1,
        status: 'rejected',
        submittedAt: new Date(Date.UTC(2025, 1, 20)),
      }),
    ]);
  }

  it('sorts by submittedAt desc/asc with a stable id tiebreak', async () => {
    const reviewer = await loginAs(app, 'reviewer');
    await seedKnownSet();

    const desc = await reviewer.get('/api/submissions').query({ sort: 'submittedAt', dir: 'desc' });
    expect(desc.body.data.map((s: { name: string }) => s.name)).toEqual(['Charlie', 'Bob', 'Alice']);

    const asc = await reviewer.get('/api/submissions').query({ sort: 'submittedAt', dir: 'asc' });
    expect(asc.body.data.map((s: { name: string }) => s.name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it.each([
    ['rating', 'asc', ['Bob', 'Charlie', 'Alice']],
    ['rating', 'desc', ['Alice', 'Charlie', 'Bob']],
    ['name', 'asc', ['Alice', 'Bob', 'Charlie']],
    ['company', 'desc', ['Bob', 'Charlie', 'Alice']], // G2 Crowd > Beta Corp > Acme
    ['status', 'asc', ['Alice', 'Charlie', 'Bob']], // approved < pending < rejected
  ] as const)('sorts by %s %s', async (sort, dir, expected) => {
    const reviewer = await loginAs(app, 'reviewer');
    await seedKnownSet();
    const res = await reviewer.get('/api/submissions').query({ sort, dir });
    expect(res.body.data.map((s: { name: string }) => s.name)).toEqual(expected);
  });

  it('a page past the end returns empty data with correct totals', async () => {
    const reviewer = await loginAs(app, 'reviewer');
    await seedKnownSet();

    const res = await reviewer.get('/api/submissions').query({ page: 400, pageSize: 25 }).expect(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(3);
    expect(res.body.totalPages).toBe(1);
  });

  it('pageSize is clamped at 100 regardless of what is requested', async () => {
    const reviewer = await loginAs(app, 'reviewer');
    await seedKnownSet();
    const res = await reviewer.get('/api/submissions').query({ pageSize: 5000 });
    expect(res.body.pageSize).toBe(100);
  });

  it('paginates without losing or duplicating rows', async () => {
    const reviewer = await loginAs(app, 'reviewer');
    await seedRows(
      Array.from({ length: 7 }, (_, i) =>
        makeSubmission({ submittedAt: new Date(Date.UTC(2025, 0, i + 1)) }),
      ),
    );

    const p1 = await reviewer.get('/api/submissions').query({ page: 1, pageSize: 3, sort: 'submittedAt', dir: 'asc' });
    const p2 = await reviewer.get('/api/submissions').query({ page: 2, pageSize: 3, sort: 'submittedAt', dir: 'asc' });
    const p3 = await reviewer.get('/api/submissions').query({ page: 3, pageSize: 3, sort: 'submittedAt', dir: 'asc' });

    const allIds = [...p1.body.data, ...p2.body.data, ...p3.body.data].map((s: { id: number }) => s.id);
    expect(new Set(allIds).size).toBe(7);
    expect(p1.body.totalPages).toBe(3);
  });

  it('filters combine: status + rating range + date range', async () => {
    const reviewer = await loginAs(app, 'reviewer');
    await seedKnownSet();

    const res = await reviewer
      .get('/api/submissions')
      .query({ status: 'pending', ratingMin: 2, dateFrom: '2025-03-01', dateTo: '2025-03-31' });
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].name).toBe('Charlie');
  });

  it('search finds a two-character term ("G2") — the FULLTEXT gotcha', async () => {
    const reviewer = await loginAs(app, 'reviewer');
    await seedKnownSet();

    const res = await reviewer.get('/api/submissions').query({ q: 'G2' });
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].company).toBe('G2 Crowd');
  });

  it('boolean-mode operators in search input are sanitized, not a SQL error', async () => {
    const reviewer = await loginAs(app, 'reviewer');
    await seedKnownSet();

    // Operators at token boundaries are stripped, leaving one token "Alice".
    const res = await reviewer.get('/api/submissions').query({ q: '(Alice) +*~@' }).expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].name).toBe('Alice');

    // Injection-flavored garbage must also be a clean 200 with no matches,
    // never a SQL syntax error.
    const res2 = await reviewer
      .get('/api/submissions')
      .query({ q: '"; DROP TABLE submissions; --' })
      .expect(200);
    expect(res2.body.total).toBe(0);
  });

  it('search matching nothing is an empty state, not an error', async () => {
    const reviewer = await loginAs(app, 'reviewer');
    await seedKnownSet();
    const res = await reviewer.get('/api/submissions').query({ q: 'zzzqqq' }).expect(200);
    expect(res.body.total).toBe(0);
    expect(res.body.data).toEqual([]);
  });

  it('an unrecognized sort value is defaulted, not a SQL error', async () => {
    const reviewer = await loginAs(app, 'reviewer');
    await seedKnownSet();
    const res = await reviewer.get('/api/submissions').query({ sort: 'email; DROP TABLE submissions--' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
  });
});
