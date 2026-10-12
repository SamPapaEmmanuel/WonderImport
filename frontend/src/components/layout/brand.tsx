import { cn } from '@/lib/cn';

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn('grid size-[28px] flex-none place-items-center rounded-[10px] bg-fjord text-on-accent', className)} aria-hidden>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7l9-4 9 4-9 4-9-4z" />
        <path d="M3 7v10l9 4 9-4V7" />
      </svg>
    </span>
  );
}
