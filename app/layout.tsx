import './globals.css';
import type { Metadata, Viewport } from 'next';

const siteName = 'WhatsApp Action Plan';
const title = `${siteName} Dashboard`;
const description =
  'Monitor webhook delivery, message ingestion, and integration health. Manage WhatsApp conversations and auto-replies in one place.';
const metadataBase =
  process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL)
    : process.env.VERCEL_URL
      ? new URL(`https://${process.env.VERCEL_URL}`)
      : new URL('https://whatsapp-action-plan.vercel.app');

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export const metadata: Metadata = {
  title: {
    default: title,
    template: `%s | ${siteName}`,
  },
  description,
  keywords: ['WhatsApp', 'dashboard', 'messaging', 'webhook', 'automation'],
  authors: [{ name: siteName }],
  creator: siteName,
  metadataBase,
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    title,
    description,
    siteName,
  },
  twitter: {
    card: 'summary',
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="app-root">{children}</body>
    </html>
  );
}
