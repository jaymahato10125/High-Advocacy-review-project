import { useState } from 'react';
import type { SubmissionFilter } from '@proofdesk/shared';
import { format } from 'date-fns';
import { ExternalLinkIcon } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { useSubmissions } from '@/lib/hooks';
import type { SortField } from '@/components/SubmissionsTable';
import { FilterBar } from '@/components/FilterBar';
import { PaginationControls } from '@/components/PaginationControls';
import { EmptyState, ErrorBanner, GallerySkeleton } from '@/components/QueryStates';
import { RatingStars } from '@/components/RatingStars';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Approved gallery (§9): same filter/search/sort/pagination, same API — but a
// testimonial wall, not a spreadsheet. Read-only: no checkboxes, no bulk bar.
export function Approved() {
  const [filter, setFilter] = useState<SubmissionFilter>({ status: 'approved' });
  const [sort, setSort] = useState<SortField>('submittedAt');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const query = useSubmissions({ filter, sort, dir, page, pageSize });

  function applyFilter(patch: Partial<SubmissionFilter>) {
    setFilter((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Approved testimonials</h1>
        <p className="text-sm text-muted-foreground">
          Ready to pull into decks and web pages. Read-only.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-full sm:min-w-0">
          <FilterBar filter={filter} onChange={applyFilter} showStatus={false} />
        </div>
        <Select
          value={`${sort}:${dir}`}
          onValueChange={(v) => {
            const [s, d] = v.split(':') as [SortField, 'asc' | 'desc'];
            setSort(s);
            setDir(d);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44" aria-label="Sort order">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="submittedAt:desc">Newest first</SelectItem>
            <SelectItem value="submittedAt:asc">Oldest first</SelectItem>
            <SelectItem value="rating:desc">Highest rated</SelectItem>
            <SelectItem value="rating:asc">Lowest rated</SelectItem>
            <SelectItem value="company:asc">Company A–Z</SelectItem>
            <SelectItem value="name:asc">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {query.isPending ? (
        <GallerySkeleton cards={6} />
      ) : query.isError ? (
        <ErrorBanner
          message={query.error instanceof ApiError ? query.error.message : 'Could not load testimonials.'}
          onRetry={() => query.refetch()}
        />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          title="No approved testimonials match"
          hint="Try widening the filters or clearing the search."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {query.data.data.map((s) => (
              <Card key={s.id} className="gap-4 py-5">
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <RatingStars rating={s.rating} />
                    <span className="text-xs text-muted-foreground capitalize">{s.type}</span>
                  </div>
                  <p className="line-clamp-4 text-sm leading-relaxed whitespace-pre-wrap">
                    {s.testimonialText}
                  </p>
                  <div className="mt-auto flex items-end justify-between pt-1">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.jobTitle ? `${s.jobTitle}, ` : ''}
                        {s.company} · {format(new Date(s.submittedAt), 'MMM yyyy')}
                      </p>
                    </div>
                    {s.sourceLink && (
                      <a
                        href={s.sourceLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors"
                        aria-label={`View source for ${s.name}'s testimonial`}
                      >
                        <ExternalLinkIcon className="size-4" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
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
