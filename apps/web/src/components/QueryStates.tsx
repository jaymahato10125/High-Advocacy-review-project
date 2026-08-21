import { AlertTriangleIcon, InboxIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// Skeleton loaders, not blank screens, under slow networks (§9/§12).
export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function GallerySkeleton({ cards = 8 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading">
      {Array.from({ length: cards }, (_, i) => (
        <Skeleton key={i} className="h-44 w-full" />
      ))}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-4 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
    >
      <span className="flex items-center gap-2 text-destructive">
        <AlertTriangleIcon className="size-4 shrink-0" />
        {message}
      </span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-16 text-center">
      <InboxIcon className="size-8 text-muted-foreground/50" />
      <p className="font-medium text-muted-foreground">{title}</p>
      {hint && <p className="text-sm text-muted-foreground/70">{hint}</p>}
    </div>
  );
}
