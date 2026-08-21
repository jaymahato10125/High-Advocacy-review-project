import type { SubmissionStatus } from '@proofdesk/shared';

// ---------------------------------------------------------------------------
// Notifications (implementation plan §8) are fake — no real email — but real
// rows: one notifications row per affected submission, inserted inside the
// same transaction as the status update, and written to the structured log at
// the point of creation.
// ---------------------------------------------------------------------------

export function renderStatusMessage(name: string, status: SubmissionStatus): string {
  switch (status) {
    case 'approved':
      return `Hi ${name}, great news — your testimonial was approved and is now featured. Thank you for sharing your experience!`;
    case 'rejected':
      return `Hi ${name}, thank you for your submission. After review, we weren't able to feature your testimonial this time.`;
    case 'pending':
      return `Hi ${name}, your testimonial was moved back to pending review. We'll take another look shortly.`;
  }
}
