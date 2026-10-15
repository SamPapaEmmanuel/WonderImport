import { cn } from '@/lib/cn';

/**
 * Photo logo on a white badge tile, so the image blends with both the dark
 * sidebar and light surfaces. Plain <img> (not next/image): avoids optimizer
 * caching so logo swaps show instantly.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'grid size-[28px] flex-none place-items-center overflow-hidden rounded-[10px] bg-white ring-1 ring-white/20',
        className,
      )}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.jpg" alt="" width={28} height={28} className="size-[28px] object-cover" />
    </span>
  );
}
