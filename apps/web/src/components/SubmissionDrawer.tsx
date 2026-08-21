import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Submission, SubmissionStatus } from '@proofdesk/shared';
import { format } from 'date-fns';
import { ExternalLinkIcon, Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StatusBadge } from './StatusBadge';
import { RatingStars } from './RatingStars';

// Detail sheet (§9): full text, link, contact info, Approve/Reject/Reset.
export function SubmissionDrawer({
  submission,
  open,
  onOpenChange,
}: {
  submission: Submission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');

  const mutation = useMutation({
    mutationFn: ({ id, status, note }: { id: number; status: SubmissionStatus; note?: string }) =>
      api<Submission>(`/api/submissions/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, rejectionNote: note || undefined }),
      }),
    onSuccess: (updated) => {
      toast.success(`Marked ${updated.name}'s testimonial as ${updated.status}`);
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      setRejecting(false);
      setRejectionNote('');
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    },
  });

  function act(status: SubmissionStatus) {
    if (!submission) return;
    if (status === 'rejected' && !rejecting) {
      setRejecting(true);
      return;
    }
    mutation.mutate({ id: submission.id, status, note: rejectionNote });
  }

  function handleOpenChange(o: boolean) {
    if (!o) {
      setRejecting(false);
      setRejectionNote('');
    }
    onOpenChange(o);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="overflow-y-auto">
        {submission && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                {submission.name}
                <StatusBadge status={submission.status} />
              </SheetTitle>
              <SheetDescription>
                {submission.jobTitle ? `${submission.jobTitle} at ` : ''}
                {submission.company}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-5 px-6 pb-6 text-sm">
              <div className="flex items-center justify-between">
                <RatingStars rating={submission.rating} />
                <span className="text-muted-foreground capitalize">{submission.type}</span>
              </div>

              {/* Rendered as text with pre-wrap: React's default escaping keeps
                  any HTML/script tags inert — no dangerouslySetInnerHTML. */}
              <blockquote className="whitespace-pre-wrap rounded-md border bg-muted/40 p-4 leading-relaxed">
                {submission.testimonialText}
              </blockquote>

              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                <dt className="text-muted-foreground">Email</dt>
                <dd>
                  <a className="text-primary hover:underline" href={`mailto:${submission.email}`}>
                    {submission.email}
                  </a>
                </dd>
                {submission.sourceLink && (
                  <>
                    <dt className="text-muted-foreground">Link</dt>
                    <dd>
                      <a
                        className="inline-flex items-center gap-1 text-primary hover:underline break-all"
                        href={submission.sourceLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {submission.sourceLink}
                        <ExternalLinkIcon className="size-3.5 shrink-0" />
                      </a>
                    </dd>
                  </>
                )}
                <dt className="text-muted-foreground">Submitted</dt>
                <dd>{format(new Date(submission.submittedAt), 'PPpp')}</dd>
                {submission.reviewedAt && (
                  <>
                    <dt className="text-muted-foreground">Reviewed</dt>
                    <dd>{format(new Date(submission.reviewedAt), 'PPpp')}</dd>
                  </>
                )}
                {submission.rejectionNote && (
                  <>
                    <dt className="text-muted-foreground">Rejection note</dt>
                    <dd className="whitespace-pre-wrap">{submission.rejectionNote}</dd>
                  </>
                )}
              </dl>

              {rejecting && (
                <div className="space-y-2">
                  <Label htmlFor="rejection-note">Rejection note (optional, internal)</Label>
                  <Textarea
                    id="rejection-note"
                    value={rejectionNote}
                    onChange={(e) => setRejectionNote(e.target.value)}
                    maxLength={500}
                    placeholder="Why is this being rejected?"
                    rows={3}
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {submission.status !== 'approved' && (
                  <Button size="sm" disabled={mutation.isPending} onClick={() => act('approved')}>
                    {mutation.isPending && <Loader2Icon className="animate-spin" />}
                    Approve
                  </Button>
                )}
                {submission.status !== 'rejected' && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={mutation.isPending}
                    onClick={() => act('rejected')}
                  >
                    {mutation.isPending && rejecting && <Loader2Icon className="animate-spin" />}
                    {rejecting ? 'Confirm reject' : 'Reject'}
                  </Button>
                )}
                {rejecting && (
                  <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
                    Cancel
                  </Button>
                )}
                {submission.status !== 'pending' && !rejecting && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() => act('pending')}
                  >
                    Reset to Pending
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
