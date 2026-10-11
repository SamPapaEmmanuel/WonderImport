import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-sm">
        <h1 className="text-lg font-semibold">This page does not exist</h1>
        <p className="mt-1.5 text-ink-2">The link may be out of date. Go back to the dashboard to continue.</p>
        <Link href="/dashboard" className="mt-4 inline-block font-medium text-fjord">
          Open dashboard
        </Link>
      </div>
    </div>
  );
}
