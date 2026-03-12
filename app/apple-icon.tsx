import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1d1d1f',
          borderRadius: 36,
        }}
      >
        <svg
          width="100"
          height="100"
          viewBox="0 0 32 32"
          fill="none"
          style={{ margin: 'auto' }}
        >
          <path
            d="M16 8c-3.3 0-6 2.7-6 6 0 1.3.4 2.5 1 3.5L8 24l2.5-3c.9.6 2 1 3.2 1 3.3 0 6-2.7 6-6s-2.7-6-6-6zm0 10.5c-1.2 0-2.3-.4-3.2-1l-.2-.1-1.7.6.6-1.7-.1-.2c-.6-.9-1-2-1-3.2 0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5-2 4.5-4.5 4.5z"
            fill="white"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
