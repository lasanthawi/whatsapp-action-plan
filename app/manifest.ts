import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WhatsApp Action Plan Dashboard',
    short_name: 'WhatsApp Desk',
    description: 'Monitor webhook delivery, message ingestion, and integration health. Manage WhatsApp conversations and auto-replies.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f5f7',
    theme_color: '#1d1d1f',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
