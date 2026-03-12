import './globals.css';
import type { Metadata, Viewport } from 'next';

const siteName = 'WhatsApp Action Plan';
const title = `${siteName} Dashboard`;
const description =
  'Monitor webhook delivery, message ingestion, and integration health. Manage WhatsApp conversations and auto-replies in one place.';

const ogImageUrl =
  'https://media.istockphoto.com/id/477819764/vector/vintage-cool-dude-man-face-aviator-sunglasses-rockabilly-haircut.jpg?s=612x612&w=0&k=20&c=9FMVqO6OvCTz30rcMuRbpGMMQ1MMvsznII_OAZJAhyw=';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1d1d1f',
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
  metadataBase:
    process.env.VERCEL_URL != null
      ? new URL(`https://${process.env.VERCEL_URL}`)
      : process.env.NEXT_PUBLIC_APP_URL
        ? new URL(process.env.NEXT_PUBLIC_APP_URL)
        : undefined,
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [{ url: ogImageUrl, type: 'image/jpeg', sizes: '612x612' }],
    apple: [{ url: ogImageUrl, type: 'image/jpeg', sizes: '612x612' }],
  },
  openGraph: {
    type: 'website',
    title,
    description,
    siteName,
    images: [{ url: ogImageUrl, width: 612, height: 612, alt: siteName }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [ogImageUrl],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{
          __html: `
            html,body{margin:0;padding:0;min-height:100%;background:#f5f5f7;color:#1d1d1f;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:15px;-webkit-font-smoothing:antialiased;}
            a{color:#0071e3;text-decoration:none;}
          `
        }} />
      </head>
      <body className="app-root">{children}</body>
    </html>
  );
}
