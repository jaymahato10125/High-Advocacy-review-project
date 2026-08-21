import { faker } from '@faker-js/faker';
import { ne } from 'drizzle-orm';
import { db, pool } from './index.js';
import { notifications, submissions, type NewSubmissionRow } from './schema.js';
import { renderStatusMessage } from '../lib/notify.js';

// ---------------------------------------------------------------------------
// Seed (implementation plan §10): 20,000 rows. Truncates first, so it's safe
// to re-run. Batches of 1,000 as multi-row INSERTs (never 20,000 individual
// inserts), whole run wrapped in one transaction.
// ---------------------------------------------------------------------------

const TOTAL = 20_000;
const BATCH = 1_000;

// Deterministic output — re-running the seed produces the same dataset.
faker.seed(42);

function weighted<T>(entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = faker.number.float({ min: 0, max: total });
  for (const [value, weight] of entries) {
    r -= weight;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1]![0];
}

const EIGHTEEN_MONTHS_MS = 548 * 24 * 60 * 60 * 1000;

function submittedAt(): Date {
  // Spread across the last ~18 months, denser in recent months: squaring a
  // uniform random biases the offset toward zero (i.e. toward now).
  const offset = EIGHTEEN_MONTHS_MS * Math.pow(faker.number.float({ min: 0, max: 1 }), 1.8);
  return new Date(Date.now() - offset);
}

const MESSY_COMPANIES = ['G2 Crowd', 'G2 & Co', 'Ben & Jerry\'s Clone', 'A&B "Quoted" Labs'];
const MESSY_NAMES = ["O'Brien-Smith", 'Zoë Müller', 'José Ángel García', 'Anne-Marie O\'Neill'];

function makeRow(i: number): NewSubmissionRow {
  const messy = i < 300; // a deliberate handful of messy rows for search/render paths
  const type = weighted<NewSubmissionRow['type']>([
    ['written', 60],
    ['video', 15],
    ['social', 15],
    ['review', 10],
  ]);
  const rating = weighted<number>([
    [1, 5],
    [2, 8],
    [3, 12],
    [4, 35],
    [5, 40],
  ]);
  const status = weighted<NewSubmissionRow['status']>([
    ['pending', 55],
    ['approved', 35],
    ['rejected', 10],
  ]);

  const at = submittedAt();
  const reviewed = status !== 'pending';
  const reviewedAt = reviewed
    ? new Date(at.getTime() + faker.number.int({ min: 3_600_000, max: 30 * 86_400_000 }))
    : null;

  const name = messy && i < 20 ? MESSY_NAMES[i % MESSY_NAMES.length]! : faker.person.fullName();
  const company =
    messy && i % 7 === 0
      ? MESSY_COMPANIES[i % MESSY_COMPANIES.length]!
      : i % 400 === 0
        ? `${faker.company.name()} G2` // ~50 rows searchable by the 2-char term "G2"
        : faker.company.name();

  let testimonialText: string;
  if (messy && i % 11 === 0) {
    // Near the 5,000-char cap
    testimonialText = faker.lorem.paragraphs(30).slice(0, 4990);
  } else if (messy && i % 5 === 0) {
    // Emoji/unicode content
    testimonialText = `${faker.lorem.sentences(2)} 🚀✨💯 ${faker.lorem.sentence()}`;
  } else {
    testimonialText = faker.lorem.paragraphs({ min: 1, max: 3 });
  }

  return {
    name,
    email: faker.internet.email({ firstName: name.split(' ')[0] }).toLowerCase(),
    company,
    jobTitle: faker.datatype.boolean({ probability: 0.7 }) ? faker.person.jobTitle() : null,
    rating,
    testimonialText,
    type,
    // source_link populated whenever type is video/social — matching the
    // form's own validation rule.
    sourceLink:
      type === 'video' || type === 'social'
        ? faker.internet.url()
        : type === 'review' && faker.datatype.boolean({ probability: 0.5 })
          ? faker.internet.url()
          : null,
    status,
    submittedAt: at,
    reviewedAt,
    reviewedBy: reviewed ? 'reviewer' : null,
    rejectionNote: status === 'rejected' ? faker.lorem.sentence() : null,
  };
}

async function main() {
  const started = Date.now();
  console.log(`Seeding ${TOTAL.toLocaleString()} submissions…`);

  await db.transaction(async (tx) => {
    await tx.execute('SET FOREIGN_KEY_CHECKS = 0');
    await tx.execute('TRUNCATE TABLE notifications');
    await tx.execute('TRUNCATE TABLE submissions');
    await tx.execute('SET FOREIGN_KEY_CHECKS = 1');

    for (let offset = 0; offset < TOTAL; offset += BATCH) {
      const batch = Array.from({ length: BATCH }, (_, i) => makeRow(offset + i));
      await tx.insert(submissions).values(batch);
      process.stdout.write(`\r  inserted ${Math.min(offset + BATCH, TOTAL).toLocaleString()} / ${TOTAL.toLocaleString()}`);
    }

    // Backfill notification history for rows that were already reviewed, so
    // the notifications log isn't empty on a fresh seed.
    const reviewed = await tx
      .select({
        id: submissions.id,
        email: submissions.email,
        name: submissions.name,
        status: submissions.status,
        reviewedAt: submissions.reviewedAt,
      })
      .from(submissions)
      .where(ne(submissions.status, 'pending'));
    const notifRows = reviewed.map((r) => ({
        submissionId: r.id,
        recipientEmail: r.email,
        previousStatus: 'pending' as const,
        newStatus: r.status,
        message: renderStatusMessage(r.name, r.status as 'approved' | 'rejected'),
        createdAt: r.reviewedAt ?? new Date(),
      }));
    for (let i = 0; i < notifRows.length; i += BATCH) {
      // eslint-disable-next-line no-await-in-loop
      await tx.insert(notifications).values(notifRows.slice(i, i + BATCH));
      await tx.insert(notifications).values(notifRows.slice(i, i + BATCH));
    }
    console.log(`\n  inserted ${notifRows.length.toLocaleString()} notification rows`);
  });

  console.log(`Seed complete in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
