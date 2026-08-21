import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Submission, SubmissionFilter, SubmissionStatus } from '@proofdesk/shared';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useSubmissions } from '@/lib/hooks';
import {
  escalateToFilter,
  isPageFullySelected,
  selectionCount,
  togglePage,
  toggleRow,
  type QueueSelection,
} from '@/lib/selection';
import { FilterBar } from '@/components/FilterBar';
import { SubmissionsTable, type SortField } from '@/components/SubmissionsTable';
import { BulkActionBar } from '@/components/BulkActionBar';
import { SubmissionDrawer } from '@/components/SubmissionDrawer';
import { PaginationControls } from '@/components/PaginationControls';
import { EmptyState, ErrorBanner, TableSkeleton } from '@/components/QueryStates';
import { Button } from '@/components/ui/button';

// The queue is the assignment (§9): filter → act on everything that matches,
// tens of thousands at once, as normal daily use.
export function Queue() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<SubmissionFilter>({ status: 'pending' });
  const [sort, setSort] = useState<SortField>('submittedAt');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [selection, setSelection] = useState<QueueSelection>(null);
  const [drawerSubmission, setDrawerSubmission] = useState<Submission | null>(null);

  const query = useSubmissions({ filter, sort, dir, page, pageSize });
  const total = query.data?.total ?? 0;
  const rows = query.data?.data ?? [];
  const pageIds = rows.map((s) => s.id);

  // Any filter/sort/search change clears the selection — a selection made
  // under one filter must never silently apply under a different one.
  function applyFilter(patch: Partial<SubmissionFilter>) {
    setFilter((f) => ({ ...f, ...patch }));
    setPage(1);
    setSelection(null);
  }

  function applySort(field: SortField) {
    if (field === sort) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(field);
      setDir(field === 'submittedAt' || field === 'rating' ? 'desc' : 'asc');
    }
    setPage(1);
    setSelection(null);
  }

  const bulkMutation = useMutation({
    mutationFn: (status: SubmissionStatus) => {
      if (!selection) return Promise.reject(new Error('Nothing selected'));
      const body =
        selection.mode === 'ids'
          ? { status, mode: 'ids', ids: [...selection.ids] }
          : { status, mode: 'filter', filter, excludeIds: [...selection.excludeIds] };
      return api<{ updatedCount: number }>('/api/submissions/bulk-status', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: ({ updatedCount }, status) => {
      toast.success(
        updatedCount === 0
          ? 'Nothing to update — everything matching is already there.'
          : `${updatedCount.toLocaleString()} testimonial${updatedCount === 1 ? '' : 's'} ${
              status === 'pending' ? 'reset to pending' : status
            }`,
      );
      setSelection(null);
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Bulk action failed');
    },
  });

  const selectedCount = selectionCount(selection, total);
  const pageFullySelected = isPageFullySelected(selection, pageIds);
  // "Select all matching filter" escalation: once every row on the page is
  // checked and more pages exist, offer the filter-mode switch.
  const showEscalationBanner = selection?.mode === 'ids' && pageFullySelected && total > pageIds.length;

  return (
    <div className="flex flex-col gap-4 pb-20">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Review queue</h1>
        <p className="text-sm text-muted-foreground">Filter, then act on everything that matches.</p>
      </div>

      <FilterBar filter={filter} onChange={applyFilter} />

      {showEscalationBanner && (
        <div className="flex items-center justify-center gap-2 rounded-md border border-primary/30 bg-accent px-4 py-2 text-sm">
          <span>All {pageIds.length} on this page are selected.</span>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => setSelection(escalateToFilter(selection))}
          >
            Select all {total.toLocaleString()} matching your filter →
          </Button>
        </div>
      )}
      {selection?.mode === 'filter' && (
        <div className="flex items-center justify-center gap-2 rounded-md border border-primary/30 bg-accent px-4 py-2 text-sm">
          <span>
            All <strong>{selectedCount.toLocaleString()}</strong> submissions matching your filter are
            selected.
          </span>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setSelection(null)}>
            Clear selection
          </Button>
        </div>
      )}

      {query.isPending ? (
        <TableSkeleton rows={10} />
      ) : query.isError ? (
        <ErrorBanner
          message={query.error instanceof ApiError ? query.error.message : 'Could not load submissions.'}
          onRetry={() => query.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState title="No submissions match" hint="Try widening the filters or clearing the search." />
      ) : (
        <>
          <SubmissionsTable
            data={rows}
            sort={sort}
            dir={dir}
            onSortChange={applySort}
            selection={selection}
            onToggleRow={(id) => setSelection((s) => toggleRow(s, id))}
            onTogglePage={(ids) => setSelection((s) => togglePage(s, ids))}
            onRowClick={setDrawerSubmission}
          />
          <PaginationControls
            page={page}
            totalPages={query.data?.totalPages ?? 1}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </>
      )}

      {selectedCount > 0 && (
        <BulkActionBar
          count={selectedCount}
          isFilterMode={selection?.mode === 'filter'}
          pending={bulkMutation.isPending}
          onAction={async (status) => {
            await bulkMutation.mutateAsync(status).catch(() => undefined);
          }}
          onClear={() => setSelection(null)}
        />
      )}

      <SubmissionDrawer
        submission={drawerSubmission}
        open={drawerSubmission !== null}
        onOpenChange={(open) => !open && setDrawerSubmission(null)}
      />
    </div>
  );
}
