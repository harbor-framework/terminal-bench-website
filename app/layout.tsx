import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { GeistSans } from 'geist/font/sans';
import { Google_Sans_Code } from 'next/font/google';

import { LogoScrollTop } from '@/components/logo-scroll-top';
import { AppProviders } from '@/components/providers/app-providers';
import { appName } from '@/lib/shared';
import { cn } from '@/lib/utils';
import './global.css';

const googleSansCode = Google_Sans_Code({
  subsets: ['latin'],
  variable: '--font-google-sans-code',
});

const siteUrl = 'https://www.tbench.ai';
const siteDescription =
  'A benchmark to measure and evolve with the frontier of agent work';

export const metadata: Metadata = {
  title: appName,
  metadataBase: new URL(siteUrl),
  description: siteDescription,
  icons: {
    icon: [{ url: '/favicon.ico' }, { url: '/fav.png', type: 'image/png' }],
    shortcut: '/favicon.ico',
    apple: '/fav.png',
  },
  openGraph: {
    title: appName,
    description: siteDescription,
    images: '/terminal-bench-og-1200x630.png',
    url: siteUrl,
    siteName: appName,
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: appName,
    description: siteDescription,
    images: [
      {
        url: '/terminal-bench-twitter-1200x630.png',
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={cn(
        googleSansCode.variable,
        GeistSans.variable,
        'font-sans',
      )}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen font-sans antialiased">
        {/* Re-apply the view-snap height floor before scroll restoration so a
            reload on a short view doesn't clamp to a different position. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(location.pathname==='/'){var v=sessionStorage.getItem('tb-home-min-height');if(v)document.body.style.minHeight=v+'px'}}catch(e){}",
          }}
        />
        <AppProviders>
          <LogoScrollTop />
          {children}
        </AppProviders>
        <Analytics />
      </body>
    </html>
  );
}
