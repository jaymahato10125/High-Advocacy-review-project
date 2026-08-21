import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { NotificationRow, Paginated } from '@proofdesk/shared';
import { format } from 'date-fns';
import { MoveRightIcon } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { PaginationControls } from '@/components/PaginationControls';
import { EmptyState, ErrorBanner, TableSkeleton } from '@/components/QueryStates';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Notifications (§8/§9): the paginated log that makes "notifications are real
// rows" visible without DB access.
export function Notifications() {
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const query = useQuery({
    queryKey: ['notifications', page],
    queryFn: () => api<Paginated<NotificationRow>>(`/api/notifications?page=${page}&pageSize=${pageSize}`),
    placeholderData: keepPreviousData,
    retry: 1,
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          One row per status change. Sending is simulated — the record is real.
        </p>
      </div>

      {query.isPending ? (
        <TableSkeleton rows={10} />
      ) : query.isError ? (
        <ErrorBanner
          message={query.error instanceof ApiError ? query.error.message : 'Could not load notifications.'}
          onRetry={() => query.refetch()}
        />
      ) : query.data.data.length === 0 ? (
        <EmptyState title="No notifications yet" hint="Approve or reject something in the queue." />
      ) : (
        <>
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Time</TableHead>
                  <TableHead>Submission</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.data.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                      {format(new Date(n.createdAt), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="tabular-nums">#{n.submissionId}</TableCell>
                    <TableCell className="max-w-52 truncate">{n.recipientEmail}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        {n.previousStatus ? <StatusBadge status={n.previousStatus} /> : <span>—</span>}
                        <MoveRightIcon className="size-3.5 text-muted-foreground" />
                        <StatusBadge status={n.newStatus} />
                      </span>
                    </TableCell>
                    <TableCell className="max-w-96 truncate text-muted-foreground" title={n.message}>
                      {n.message}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls
            page={page}
            totalPages={query.data.totalPages}
            total={query.data.total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
