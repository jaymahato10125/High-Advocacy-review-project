import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ListQuery, Paginated, Submission, SubmissionFilter } from '@proofdesk/shared';
import { api, toQueryString } from './api';

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export interface SubmissionsQueryState {
  filter: SubmissionFilter;
  sort: NonNullable<ListQuery['sort']>;
  dir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export function useSubmissions(state: SubmissionsQueryState) {
  // The query key fully describes the request: TanStack Query de-dupes
  // identical in-flight requests and never lets a slow response to an earlier
  // filter clobber a fast response to a later one (implementation plan §12).
  return useQuery({
    queryKey: ['submissions', state],
    queryFn: () =>
      api<Paginated<Submission>>(
        `/api/submissions${toQueryString({
          status: state.filter.status,
          type: state.filter.type,
          ratingMin: state.filter.ratingMin,
          ratingMax: state.filter.ratingMax,
          dateFrom: state.filter.dateFrom,
          dateTo: state.filter.dateTo,
          q: state.filter.q,
          sort: state.sort,
          dir: state.dir,
          page: state.page,
          pageSize: state.pageSize,
        })}`,
      ),
    placeholderData: keepPreviousData,
    retry: 1,
  });
}
