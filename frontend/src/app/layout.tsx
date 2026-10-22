
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeInit } from '@/components/layout/theme-init';

export const metadata: Metadata = {
  title: { default: 'WonderImport', template: '%s · WonderImport' },
  description: 'Goods, shipments and profitability for the importation business.',
  icons: { icon: '/favicon.svg' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f4f7' },
    { media: '(prefers-color-scheme: dark)', color: '#101014' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set the saved theme before the first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=JSON.parse(localStorage.getItem('wonderimport-ui')||'{}').state?.theme;if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <ThemeInit />
        {children}
      </body>
    </html>
  );
}
