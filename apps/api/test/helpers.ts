import request from 'supertest';
import type { Express } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { submissions, type NewSubmissionRow } from '../src/db/schema.js';

export function loginAs(app: Express, role: 'reviewer' | 'viewer') {
  const agent = request.agent(app);
  // Logs the agent in and returns it — subsequent requests carry the cookie.
  return agent
    .post('/api/auth/login')
    .send({ role })
    .expect(200)
    .then(() => agent);
}

export async function resetTables() {
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  await db.execute(sql`TRUNCATE TABLE notifications`);
  await db.execute(sql`TRUNCATE TABLE submissions`);
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}

let counter = 0;

export function makeSubmission(overrides: Partial<NewSubmissionRow> = {}): NewSubmissionRow {
  counter += 1;
  return {
    name: `Test User ${counter}`,
    email: `user${counter}@example.com`,
    company: `Company ${counter}`,
    jobTitle: 'Engineer',
    rating: 4,
    testimonialText: `Testimonial text ${counter}`,
    type: 'written',
    sourceLink: null,
    status: 'pending',
    submittedAt: new Date(Date.UTC(2025, 0, 1) + counter * 86_400_000),
    ...overrides,
  };
}

export async function seedRows(rows: NewSubmissionRow[]): Promise<number[]> {
  const [result] = await db.insert(submissions).values(rows);
  const firstId = Number(result.insertId);
  return rows.map((_, i) => firstId + i);
}
