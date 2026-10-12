import { BrandMark } from '@/components/layout/brand';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="hidden flex-col justify-between bg-harbour p-10 text-side-text lg:flex">
        <span className="flex items-center gap-2.5 text-base font-semibold text-white">
          <BrandMark />
          WonderImport
        </span>
        <div className="max-w-md">
          <p className="text-[22px] leading-snug font-medium text-white">Every parcel from the supplier in China to the client’s hands, with the profit on each one.</p>
          <ol className="mt-8 flex items-center gap-0" aria-label="Shipping stages">
            {['Ordered', 'At supplier', 'China warehouse', 'In transit', 'Arrived', 'Delivered'].map((s, i, all) => (
              <li key={s} className="flex flex-1 items-center last:flex-none" title={s}>
                <span className="size-3 rounded-full border-[3px] border-fjord" />
                {i < all.length - 1 && <span className="h-0.5 flex-1 bg-harbour-2" />}
                <span className="sr-only">{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-xs">Internal tool. Access is by invitation.</p>
      </aside>
      <main id="main" className="flex items-center justify-center bg-surface px-6 py-12">
        <div className="w-full max-w-[380px]">{children}</div>
      </main>
    </div>
  );
}
