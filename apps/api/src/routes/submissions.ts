import { Router } from 'express';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { rateLimit } from 'express-rate-limit';
import {
  bulkStatusSchema,
  createSubmissionSchema,
  listQuerySchema,
  updateStatusSchema,
  type SubmissionFilter,
} from '@proofdesk/shared';
import { db } from '../db/index.js';
import { notifications, submissions, type SubmissionRow } from '../db/schema.js';
import { authenticate, requireReviewer } from '../middleware/auth.js';
import { buildWhere } from '../lib/filters.js';
import { bulkUpdateStatus } from '../lib/bulkStatus.js';
import { renderStatusMessage } from '../lib/notify.js';
import { toSubmission } from '../lib/serialize.js';
import { HttpError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const submissionsRouter = Router();

// ---------------------------------------------------------------------------
// POST /api/submissions — public form endpoint. Rate-limited: cheap insurance
// against the "unexpected input" load-testing the brief describes.
// ---------------------------------------------------------------------------
const submitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_MAX ?? 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many submissions from this IP, please try again later.' } },
});

submissionsRouter.post('/', submitLimiter, async (req, res) => {
  const parsed = createSubmissionSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, 'Validation failed', parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  const [result] = await db.insert(submissions).values({
    name: data.name,
    email: data.email,
    company: data.company,
    jobTitle: data.jobTitle ?? null,
    rating: data.rating,
    testimonialText: data.testimonialText,
    type: data.type,
    sourceLink: data.sourceLink ?? null,
    status: 'pending', // server-owned, never taken from the client
    submittedAt: new Date(),
  });
  res.status(201).json({ id: Number(result.insertId), status: 'pending' });
});

// Everything below requires a session.
submissionsRouter.use(authenticate);

// ---------------------------------------------------------------------------
// GET /api/submissions — filter / sort / search / paginate (§5, §7).
// Viewer scoping happens server-side, not by refusing the request: a viewer's
// ?status=pending is ignored and forced to 'approved'.
// ---------------------------------------------------------------------------
const SORT_COLUMNS = {
  submittedAt: submissions.submittedAt,
  rating: submissions.rating,
  status: submissions.status,
  company: submissions.company,
  name: submissions.name,
} as const;

submissionsRouter.get('/', async (req, res) => {
  // Unknown/invalid sort, dir, page, pageSize values are defaulted, not
  // errors — an unrecognized sort must never become a SQL error.
  const query = listQuerySchema.parse(req.query);

  const filter: SubmissionFilter = {
    status: query.status,
    type: query.type,
    ratingMin: query.ratingMin,
    ratingMax: query.ratingMax,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    q: query.q,
  };
  if (req.auth!.role === 'viewer') {
    filter.status = 'approved'; // don't trust the param, don't refuse either
  }

  const where = buildWhere(filter);
  const sortCol = SORT_COLUMNS[query.sort];
  // Secondary sort by id keeps pagination stable when the primary key ties.
  const orderBy =
    query.dir === 'asc' ? [asc(sortCol), asc(submissions.id)] : [desc(sortCol), desc(submissions.id)];

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(submissions)
      .where(where)
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    // Same WHERE as the row fetch, so the count benefits from the same indexes.
    db.select({ count: sql<number>`count(*)` }).from(submissions).where(where),
  ]);

  const total = Number(countRows[0]?.count ?? 0);
  res.json({
    data: rows.map(toSubmission),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  });
});

// ---------------------------------------------------------------------------
// POST /api/submissions/bulk-status — the bulk endpoint (§6). Declared before
// /:id so "bulk-status" is never captured as an id.
// ---------------------------------------------------------------------------
submissionsRouter.post('/bulk-status', requireReviewer, async (req, res) => {
  const parsed = bulkStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, 'Validation failed', parsed.error.flatten().fieldErrors);
  }
  const result = await bulkUpdateStatus(parsed.data, 'reviewer');
  res.json(result);
});

// ---------------------------------------------------------------------------
// GET /api/submissions/:id — detail. A viewer asking for a non-approved row
// gets 404, not 403: don't confirm existence.
// ---------------------------------------------------------------------------
submissionsRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'Submission not found');

  const [row] = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
  if (!row) throw new HttpError(404, 'Submission not found');
  if (req.auth!.role === 'viewer' && row.status !== 'approved') {
    throw new HttpError(404, 'Submission not found');
  }
  res.json(toSubmission(row));
});

// ---------------------------------------------------------------------------
// PATCH /api/submissions/:id/status — single-item version of the bulk logic:
// same transaction shape, same notification semantics.
// ---------------------------------------------------------------------------
submissionsRouter.patch('/:id/status', requireReviewer, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'Submission not found');

  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, 'Validation failed', parsed.error.flatten().fieldErrors);
  }
  const { status, rejectionNote } = parsed.data;
  const now = new Date();

  const updated = await db.transaction(async (tx): Promise<SubmissionRow | null> => {
    // Row-lock before mutating, and capture the actual previous status.
    const [row] = await tx
      .select()
      .from(submissions)
      .where(eq(submissions.id, id))
      .limit(1)
      .for('update');
    if (!row) return null;

    if (row.status !== status) {
      await tx
        .update(submissions)
        .set({
          status,
          reviewedAt: now,
          reviewedBy: 'reviewer',
          updatedAt: now,
          // A rejection note only makes sense attached to a rejection.
          rejectionNote: status === 'rejected' ? (rejectionNote ?? null) : null,
        })
        .where(eq(submissions.id, id));

      // Notification row inside the same transaction — update and
      // notification commit or roll back together.
      await tx.insert(notifications).values({
        submissionId: row.id,
        recipientEmail: row.email,
        previousStatus: row.status,
        newStatus: status,
        message: renderStatusMessage(row.name, status),
        createdAt: now,
      });
      logger.info(
        { submissionId: row.id, previousStatus: row.status, newStatus: status },
        'notification created',
      );
    }

    const [fresh] = await tx.select().from(submissions).where(eq(submissions.id, id)).limit(1);
    return fresh ?? null;
  });

  if (!updated) throw new HttpError(404, 'Submission not found');
  res.json(toSubmission(updated));
});
