import { StarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Read-only star display used in the table, drawer, and approved gallery.
export function RatingStars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon
          key={i}
          className={cn('size-3.5', i <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')}
        />
      ))}
    </span>
  );
}

// Interactive picker for the public form — no default selection, forcing an
// explicit choice (implementation plan §9).
export function RatingPicker({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (rating: number) => void;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
          onClick={() => onChange(i)}
          className="rounded-sm p-0.5 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-ring cursor-pointer"
        >
          <StarIcon
            className={cn(
              'size-7',
              value !== undefined && i <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40',
            )}
          />
        </button>
      ))}
    </div>
  );
}
