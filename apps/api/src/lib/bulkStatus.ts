import { and, inArray, ne, notInArray, type SQL } from 'drizzle-orm';
import type { BulkStatusInput } from '@proofdesk/shared';
import { db } from '../db/index.js';
import { notifications, submissions } from '../db/schema.js';
import { buildWhere } from './filters.js';
import { renderStatusMessage } from './notify.js';
import { BulkTooLargeError } from './errors.js';
import { logger } from './logger.js';

// ---------------------------------------------------------------------------
// The bulk-status transaction (implementation plan §6 — the heart of the
// assignment). The filter is translated to a SQL WHERE via the same buildWhere
// that powers the listing endpoint; IDs are never shipped from the browser at
// scale.
// ---------------------------------------------------------------------------

const MAX_BULK_ROWS = Number(process.env.BULK_ACTION_MAX_ROWS ?? 250_000);
const CHUNK_SIZE = 2000;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function bulkUpdateStatus(
  input: BulkStatusInput,
  actingRole: 'reviewer',
): Promise<{ updatedCount: number }> {
  // Computed once in application code — the update and the notification insert
  // are separate statements and must agree on exactly which moment "this
  // batch" happened at.
  const now = new Date();

  return db.transaction(async (tx) => {
    let where: SQL | undefined =
      input.mode === 'ids' ? inArray(submissions.id, input.ids!) : buildWhere(input.filter!);

    if (input.mode === 'filter' && input.excludeIds?.length) {
      where = and(where, notInArray(submissions.id, input.excludeIds));
    }
    // Idempotency guard: rows already in the target status are excluded, not
    // re-touched. A retried request or double-click finds zero remaining
    // matching rows and does nothing — no duplicate notifications.
    where = and(where, ne(submissions.status, input.status));

    // Capture + row-lock the affected set before mutating, so we know each
    // row's *actual* previous status (a mixed-status filter is legal) and a
    // second overlapping bulk action against any of the same rows blocks until
    // this transaction commits instead of racing to an inconsistent result.
    const affected = await tx
      .select({
        id: submissions.id,
        email: submissions.email,
        name: submissions.name,
        previousStatus: submissions.status,
      })
      .from(submissions)
      .where(where)
      .limit(MAX_BULK_ROWS + 1)
      .for('update');

    if (affected.length === 0) return { updatedCount: 0 };
    if (affected.length > MAX_BULK_ROWS) {
      throw new BulkTooLargeError(MAX_BULK_ROWS);
    }

    // Chunked at 2,000 rows per statement so individual UPDATE/INSERT
    // statements stay a sane size whether the batch is 500 rows or 200,000.
    const ids = affected.map((r) => r.id);
    for (const idChunk of chunk(ids, CHUNK_SIZE)) {
      await tx
        .update(submissions)
        .set({
          status: input.status,
          reviewedAt: now,
          reviewedBy: actingRole,
          updatedAt: now,
          // A rejection note only ever makes sense attached to a rejection;
          // approving/resetting clears any stale note.
          ...(input.status === 'rejected' ? {} : { rejectionNote: null }),
        })
        .where(inArray(submissions.id, idChunk));
    }

    // One notification row per affected submission, inside the same
    // transaction — a mid-batch failure can't leave an update without its
    // notification or vice versa.
    const notifRows = affected.map((r) => ({
      submissionId: r.id,
      recipientEmail: r.email,
      previousStatus: r.previousStatus,
      newStatus: input.status,
      message: renderStatusMessage(r.name, input.status),
      createdAt: now,
    }));
    for (const rowChunk of chunk(notifRows, CHUNK_SIZE)) {
      await tx.insert(notifications).values(rowChunk);
      logger.info({ count: rowChunk.length, status: input.status }, 'notifications created');
    }

    return { updatedCount: affected.length };
  });
}
