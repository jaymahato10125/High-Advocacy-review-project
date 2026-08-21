import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  datetime,
  foreignKey,
  index,
  mysqlTable,
  text,
  tinyint,
  varchar,
} from 'drizzle-orm/mysql-core';

// ---------------------------------------------------------------------------
// Data model (implementation plan §3). Two tables; no users table — the two
// fixed users are constants in server config, not rows.
//
// `type`/`status` are VARCHAR + CHECK, not MySQL ENUM: adding a new value later
// doesn't touch column metadata. MySQL enforces CHECK from 8.0.16+ (we're on
// 8.4), so these are real constraints, not decorative. Zod validates the same
// values at the API boundary — the CHECK is a backstop, not the primary line
// of defense.
// ---------------------------------------------------------------------------

export const submissions = mysqlTable(
  'submissions',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    company: varchar('company', { length: 160 }).notNull(),
    jobTitle: varchar('job_title', { length: 160 }),
    rating: tinyint('rating', { unsigned: true }).notNull(),
    testimonialText: text('testimonial_text').notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    sourceLink: varchar('source_link', { length: 2048 }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    submittedAt: datetime('submitted_at', { mode: 'date' }).notNull(),
    // Role string, not a FK — there is no user table. If real auth is ever
    // added this becomes a proper FK.
    reviewedAt: datetime('reviewed_at', { mode: 'date' }),
    reviewedBy: varchar('reviewed_by', { length: 20 }),
    rejectionNote: varchar('rejection_note', { length: 500 }),
    createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at', { mode: 'date' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
  },
  (t) => [
    check('chk_rating', sql`${t.rating} BETWEEN 1 AND 5`),
    check('chk_type', sql`${t.type} IN ('written','video','social','review')`),
    check('chk_status', sql`${t.status} IN ('pending','approved','rejected')`),
    index('idx_status_submitted').on(t.status, t.submittedAt),
    index('idx_status_rating').on(t.status, t.rating),
    index('idx_type').on(t.type),
    index('idx_submitted_at').on(t.submittedAt),
    // NOTE: FULLTEXT INDEX idx_search (name, company, testimonial_text, email)
    // lives in a custom migration (0001_fulltext_search.sql) — drizzle-orm's
    // mysql-core does not expose a fulltextIndex builder in this version.
  ],
);

export const notifications = mysqlTable(
  'notifications',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    submissionId: bigint('submission_id', { mode: 'number', unsigned: true }).notNull(),
    recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
    previousStatus: varchar('previous_status', { length: 20 }),
    newStatus: varchar('new_status', { length: 20 }).notNull(),
    message: text('message').notNull(),
    createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    foreignKey({
      columns: [t.submissionId],
      foreignColumns: [submissions.id],
      name: 'fk_notifications_submission',
    }),
    index('idx_submission').on(t.submissionId, t.createdAt),
  ],
);

export type SubmissionRow = typeof submissions.$inferSelect;
export type NewSubmissionRow = typeof submissions.$inferInsert;
export type NotificationDbRow = typeof notifications.$inferSelect;
export type NewNotificationRow = typeof notifications.$inferInsert;
