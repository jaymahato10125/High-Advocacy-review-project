import type { SubmissionStatus } from '@proofdesk/shared';
import { Badge } from '@/components/ui/badge';

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  return <Badge variant={status}>{status}</Badge>;
}
