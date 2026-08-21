import type { Submission } from '@proofdesk/shared';
import type { ListQuery } from '@proofdesk/shared';
import { format } from 'date-fns';
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from './StatusBadge';
import { RatingStars } from './RatingStars';
import type { QueueSelection } from '@/lib/selection';
import { isRowSelected, pageCheckboxState } from '@/lib/selection';

export type SortField = NonNullable<ListQuery['sort']>;

const COLUMNS: { key: SortField; label: string; className?: string }[] = [
  { key: 'submittedAt', label: 'Submitted' },
  { key: 'name', label: 'Name' },
  { key: 'company', label: 'Company' },
  { key: 'rating', label: 'Rating' },
  // type/status are filter dimensions more than sort dimensions; status is
  // sortable per the API contract, type renders unsorted.
];

export function SubmissionsTable({
  data,
  sort,
  dir,
  onSortChange,
  selection,
  onToggleRow,
  onTogglePage,
  onRowClick,
}: {
  data: Submission[];
  sort: SortField;
  dir: 'asc' | 'desc';
  onSortChange: (field: SortField) => void;
  selection: QueueSelection;
  onToggleRow: (id: number) => void;
  onTogglePage: (pageIds: number[]) => void;
  onRowClick: (submission: Submission) => void;
}) {
  const pageIds = data.map((s) => s.id);

  function sortIcon(field: SortField) {
    if (sort !== field) return <ArrowUpDownIcon className="size-3.5 opacity-40" />;
    return dir === 'asc' ? <ArrowUpIcon className="size-3.5" /> : <ArrowDownIcon className="size-3.5" />;
  }

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 pl-4">
              <Checkbox
                aria-label="Select all rows on this page"
                checked={pageCheckboxState(selection, pageIds)}
                onCheckedChange={() => onTogglePage(pageIds)}
              />
            </TableHead>
            {COLUMNS.map((col) => (
              <TableHead key={col.key}>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                  onClick={() => onSortChange(col.key)}
                  aria-label={`Sort by ${col.label}`}
                >
                  {col.label}
                  {sortIcon(col.key)}
                </button>
              </TableHead>
            ))}
            <TableHead>Type</TableHead>
            <TableHead>
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                onClick={() => onSortChange('status')}
                aria-label="Sort by status"
              >
                Status
                {sortIcon('status')}
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((s) => {
            const selected = isRowSelected(selection, s.id);
            return (
              <TableRow
                key={s.id}
                data-state={selected ? 'selected' : undefined}
                className="cursor-pointer"
                onClick={() => onRowClick(s)}
              >
                <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    aria-label={`Select submission from ${s.name}`}
                    checked={selected}
                    onCheckedChange={() => onToggleRow(s.id)}
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                  {format(new Date(s.submittedAt), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="font-medium max-w-44 truncate">{s.name}</TableCell>
                <TableCell className="max-w-44 truncate">{s.company}</TableCell>
                <TableCell>
                  <RatingStars rating={s.rating} />
                </TableCell>
                <TableCell className="capitalize text-muted-foreground">{s.type}</TableCell>
                <TableCell>
                  <StatusBadge status={s.status} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
