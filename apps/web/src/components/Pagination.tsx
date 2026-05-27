"use client";

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  label?: string;
}

export function Pagination({ page, totalPages, onPageChange, className = "", label }: Props) {
  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-between gap-2 text-xs ${className}`}>
      {label && <span className="text-ink/40 font-bold">{label}</span>}
      <div className="flex items-center gap-2 ml-auto">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-primary/15 px-2.5 py-1 font-bold text-primary disabled:opacity-40 hover:bg-surface"
        >
          上一页
        </button>
        <span className="text-ink/50 font-mono">
          {page}/{totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-primary/15 px-2.5 py-1 font-bold text-primary disabled:opacity-40 hover:bg-surface"
        >
          下一页
        </button>
      </div>
    </div>
  );
}

export function paginateSlice<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    items: items.slice(start, start + pageSize),
  };
}
