import type { Submission } from '@proofdesk/shared';
import type { NotificationDbRow, SubmissionRow } from '../db/schema.js';

export function toSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    jobTitle: row.jobTitle,
    rating: row.rating as Submission['rating'],
    testimonialText: row.testimonialText,
    type: row.type as Submission['type'],
    sourceLink: row.sourceLink,
    status: row.status as Submission['status'],
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    reviewedBy: (row.reviewedBy as Submission['reviewedBy']) ?? null,
    rejectionNote: row.rejectionNote,
  };
}

export function toNotification(row: NotificationDbRow) {
  return {
    id: row.id,
    submissionId: row.submissionId,
    recipientEmail: row.recipientEmail,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  };
}
