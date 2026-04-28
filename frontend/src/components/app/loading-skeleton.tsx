interface ListSkeletonProps {
  rows?: number;
}

export function ListSkeleton({ rows = 3 }: ListSkeletonProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 animate-pulse rounded-md bg-muted" />
      <div className="h-8 animate-pulse rounded-md bg-muted" />
      <div className="h-10 animate-pulse rounded-md bg-muted" />
    </div>
  );
}
