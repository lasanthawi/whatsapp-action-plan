import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WhatsApp Action Plan Dashboard',
  description: 'Monitor webhook delivery, message ingestion, and integration health.',
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
