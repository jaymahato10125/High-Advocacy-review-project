import { useEffect, useState } from 'react';
import type { SubmissionFilter, SubmissionStatus, SubmissionType } from '@proofdesk/shared';
import { useDebouncedValue } from '@/lib/hooks';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchIcon } from 'lucide-react';

const STATUS_TABS: { value: SubmissionStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const TYPE_OPTIONS: { value: SubmissionType; label: string }[] = [
  { value: 'written', label: 'Written' },
  { value: 'video', label: 'Video' },
  { value: 'social', label: 'Social' },
  { value: 'review', label: 'Review' },
];

export function FilterBar({
  filter,
  onChange,
  showStatus = true,
}: {
  filter: SubmissionFilter;
  onChange: (patch: Partial<SubmissionFilter>) => void;
  showStatus?: boolean;
}) {
  // Debounced (300ms) search box — the debounce is what keeps typing from
  // hammering the API on a slow network.
  const [searchInput, setSearchInput] = useState(filter.q ?? '');
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    if ((debouncedSearch || undefined) !== filter.q) {
      onChange({ q: debouncedSearch || undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const ratingOptions = [1, 2, 3, 4, 5];

  return (
    <div className="flex flex-col gap-3">
      {showStatus && (
        <Tabs
          value={filter.status ?? 'all'}
          onValueChange={(v) => onChange({ status: v === 'all' ? undefined : (v as SubmissionStatus) })}
        >
          <TabsList>
            {STATUS_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, company, text, email…"
            className="pl-8"
            aria-label="Search submissions"
          />
        </div>

        <Select
          value={filter.type ?? 'all'}
          onValueChange={(v) => onChange({ type: v === 'all' ? undefined : (v as SubmissionType) })}
        >
          <SelectTrigger className="w-32" aria-label="Type filter">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPE_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.ratingMin?.toString() ?? 'any'}
          onValueChange={(v) => onChange({ ratingMin: v === 'any' ? undefined : Number(v) })}
        >
          <SelectTrigger className="w-28" aria-label="Minimum rating">
            <SelectValue placeholder="Min ★" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Min ★</SelectItem>
            {ratingOptions.map((r) => (
              <SelectItem key={r} value={String(r)}>
                {r}★ & up
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.ratingMax?.toString() ?? 'any'}
          onValueChange={(v) => onChange({ ratingMax: v === 'any' ? undefined : Number(v) })}
        >
          <SelectTrigger className="w-28" aria-label="Maximum rating">
            <SelectValue placeholder="Max ★" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Max ★</SelectItem>
            {ratingOptions.map((r) => (
              <SelectItem key={r} value={String(r)}>
                {r}★ & under
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={filter.dateFrom ?? ''}
          onChange={(e) => onChange({ dateFrom: e.target.value || undefined })}
          className="w-36"
          aria-label="Submitted from"
        />
        <span className="text-muted-foreground text-sm">–</span>
        <Input
          type="date"
          value={filter.dateTo ?? ''}
          onChange={(e) => onChange({ dateTo: e.target.value || undefined })}
          className="w-36"
          aria-label="Submitted until"
        />
      </div>
    </div>
  );
}
