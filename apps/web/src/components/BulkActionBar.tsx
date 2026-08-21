import { useState } from 'react';
import type { SubmissionStatus } from '@proofdesk/shared';
import { CheckIcon, Loader2Icon, RotateCcwIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Bulk action bar (§9): every action sits behind a confirmation dialog stating
// the exact count and target status — the easiest thing to get wrong is
// applying to more rows than the reviewer intended, so the confirmation is not
// optional, especially when the filter is empty ("this affects all 20,000").
const ACTIONS: { status: SubmissionStatus; label: string; icon: typeof CheckIcon; danger?: boolean }[] = [
  { status: 'approved', label: 'Approve', icon: CheckIcon },
  { status: 'rejected', label: 'Reject', icon: XIcon, danger: true },
  { status: 'pending', label: 'Reset to Pending', icon: RotateCcwIcon },
];

export function BulkActionBar({
  count,
  isFilterMode,
  pending,
  onAction,
  onClear,
}: {
  count: number;
  isFilterMode: boolean;
  pending: boolean;
  onAction: (status: SubmissionStatus) => Promise<void>;
  onClear: () => void;
}) {
  const [confirming, setConfirming] = useState<SubmissionStatus | null>(null);

  async function confirm() {
    if (!confirming) return;
    await onAction(confirming);
    setConfirming(null);
  }

  return (
    <>
      <div className="sticky bottom-4 z-10 mx-auto flex w-fit items-center gap-3 rounded-lg border bg-card px-4 py-2.5 shadow-lg">
        <span className="text-sm font-medium tabular-nums">
          {count.toLocaleString()} selected
          {isFilterMode && <span className="ml-1 text-muted-foreground font-normal">(all matching filter)</span>}
        </span>
        <div className="h-5 w-px bg-border" />
        {ACTIONS.map(({ status, label, icon: Icon, danger }) => (
          <Button
            key={status}
            size="sm"
            variant={danger ? 'destructive' : status === 'approved' ? 'default' : 'outline'}
            disabled={pending || count === 0}
            onClick={() => setConfirming(status)}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <Icon />}
            {label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" disabled={pending} onClick={onClear}>
          Clear
        </Button>
      </div>

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirming === 'approved' && 'Approve'}
              {confirming === 'rejected' && 'Reject'}
              {confirming === 'pending' && 'Reset to pending'}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This will set{' '}
                  <span className="font-semibold text-foreground">{count.toLocaleString()}</span>{' '}
                  testimonial{count === 1 ? '' : 's'}
                  {isFilterMode ? ' matching the current filter' : ''} to{' '}
                  <span className="font-semibold text-foreground">{confirming}</span>, and a
                  notification will be recorded for each one.
                </p>
                {isFilterMode && (
                  <p className="text-xs">
                    The action re-evaluates the filter against live data on the server — any row
                    that changed since you loaded this page is handled correctly.
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              variant={confirming === 'rejected' ? 'destructive' : 'default'}
              disabled={pending}
              onClick={confirm}
            >
              {pending && <Loader2Icon className="animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
