import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, inArray, sql } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { notifications, submissions } from '../src/db/schema.js';
import { loginAs, makeSubmission, resetTables, seedRows } from './helpers.js';

// Test 1 (implementation plan §11): bulk-status correctness + idempotency.
const app = createApp();

afterAll(async () => {
  await pool.end();
});

describe('POST /api/submissions/bulk-status', () => {
  beforeEach(resetTables);

  it('updates exactly the matching rows, notifies 1:1, and is idempotent', async () => {
    const reviewer = await loginAs(app, 'reviewer');

    // Mixed-status set sharing one filter target (rating 5), plus decoys.
    const ids = await seedRows([
      makeSubmission({ rating: 5, status: 'pending' }),
      makeSubmission({ rating: 5, status: 'rejected', rejectionNote: 'nope' }),
      makeSubmission({ rating: 5, status: 'approved' }), // already in target
      makeSubmission({ rating: 4, status: 'pending' }), // outside filter
      makeSubmission({ rating: 3, status: 'pending' }), // outside filter
    ]);

    const filter = { ratingMin: 5, ratingMax: 5 };
    const first = await reviewer
      .post('/api/submissions/bulk-status')
      .send({ status: 'approved', mode: 'filter', filter })
      .expect(200);

    // Only the two 5-star rows not already approved change.
    expect(first.body.updatedCount).toBe(2);

    const rows = await db
      .select({ id: submissions.id, status: submissions.status, reviewedBy: submissions.reviewedBy })
      .from(submissions)
      .where(inArray(submissions.id, ids));
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(ids[0]!)?.status).toBe('approved');
    expect(byId.get(ids[1]!)?.status).toBe('approved');
    expect(byId.get(ids[1]!)?.reviewedBy).toBe('reviewer');
    expect(byId.get(ids[2]!)?.status).toBe('approved'); // untouched, already approved
    expect(byId.get(ids[3]!)?.status).toBe('pending'); // decoy untouched
    expect(byId.get(ids[4]!)?.status).toBe('pending'); // decoy untouched

    // Notification rows match 1:1 with the actually-updated rows.
    const notifs = await db
      .select()
      .from(notifications)
      .where(inArray(notifications.submissionId, ids));
    expect(notifs).toHaveLength(2);
    expect(notifs.map((n) => n.submissionId).sort()).toEqual([ids[0], ids[1]].sort());
    const rejectedRowNotif = notifs.find((n) => n.submissionId === ids[1]!)!;
    expect(rejectedRowNotif.previousStatus).toBe('rejected');
    expect(rejectedRowNotif.newStatus).toBe('approved');

    // The identical call again is a no-op (idempotency guard).
    const second = await reviewer
      .post('/api/submissions/bulk-status')
      .send({ status: 'approved', mode: 'filter', filter })
      .expect(200);
    expect(second.body.updatedCount).toBe(0);
    const notifCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(inArray(notifications.submissionId, ids));
    expect(Number(notifCount[0]?.count ?? 0)).toBe(2); // no duplicates
  });


  it('mode "ids" updates only those ids', async () => {
    const reviewer = await loginAs(app, 'reviewer');
    const ids = await seedRows([
      makeSubmission({ status: 'pending' }),
      makeSubmission({ status: 'pending' }),
      makeSubmission({ status: 'pending' }),
    ]);

    const res = await reviewer
      .post('/api/submissions/bulk-status')
      .send({ status: 'rejected', mode: 'ids', ids: [ids[0], ids[2]] })
      .expect(200);
    expect(res.body.updatedCount).toBe(2);

    const remaining = await db
      .select({ status: submissions.status })
      .from(submissions)
      .where(eq(submissions.id, ids[1]!));
    expect(remaining[0]!.status).toBe('pending');
  });

  it('excludeIds keeps rows out of a filter-mode update', async () => {
    const reviewer = await loginAs(app, 'reviewer');
    const ids = await seedRows([
      makeSubmission({ type: 'video', sourceLink: 'https://example.com/v1', status: 'pending' }),
      makeSubmission({ type: 'video', sourceLink: 'https://example.com/v2', status: 'pending' }),
      makeSubmission({ type: 'video', sourceLink: 'https://example.com/v3', status: 'pending' }),
    ]);

    const res = await reviewer
      .post('/api/submissions/bulk-status')
      .send({ status: 'approved', mode: 'filter', filter: { type: 'video' }, excludeIds: [ids[1]!] })
      .expect(200);
    expect(res.body.updatedCount).toBe(2);

    const excluded = await db
      .select({ status: submissions.status })
      .from(submissions)
      .where(eq(submissions.id, ids[1]!));
    expect(excluded[0]!.status).toBe('pending');
  });

  it('a filter matching zero rows is a no-op, not an error', async () => {
    const reviewer = await loginAs(app, 'reviewer');
    await seedRows([makeSubmission({ status: 'approved' })]);

    const res = await reviewer
      .post('/api/submissions/bulk-status')
      .send({ status: 'approved', mode: 'filter', filter: { status: 'pending' } })
      .expect(200);
    expect(res.body.updatedCount).toBe(0);

    // Nothing was ever written
    const countRows = await db.select({ count: sql<number>`count(*)` }).from(notifications);
    expect(Number(countRows[0]?.count ?? 0)).toBe(0);
  });

  it('agrees with the listing count for the same filter', async () => {
    const reviewer = await loginAs(app, 'reviewer');
    await seedRows([
      makeSubmission({ rating: 1, status: 'pending' }),
      makeSubmission({ rating: 1, status: 'approved' }),
      makeSubmission({ rating: 2, status: 'pending' }),
    ]);

    const list = await reviewer
      .get('/api/submissions')
      .query({ ratingMin: 1, ratingMax: 1 })
      .expect(200);

    const bulk = await reviewer
      .post('/api/submissions/bulk-status')
      .send({ status: 'rejected', mode: 'filter', filter: { ratingMin: 1, ratingMax: 1 } })
      .expect(200);

    // The count the reviewer saw and the rows the bulk action touched must
    // agree — both are generated by the same buildWhere().
    expect(bulk.body.updatedCount).toBe(list.body.total);
  });
});
