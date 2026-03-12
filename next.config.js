/** @type {import('next').NextConfig} */
const nextConfig = {
  // Expose Neon Auth env to Edge (middleware) by inlining at build time
  env: {
    NEON_AUTH_COOKIE_SECRET: process.env.NEON_AUTH_COOKIE_SECRET,
    NEON_AUTH_BASE_URL: process.env.NEON_AUTH_BASE_URL,
  },
};

module.exports = nextConfig;
