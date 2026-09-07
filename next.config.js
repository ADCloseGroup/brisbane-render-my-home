/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ported from netlify.toml, which Vercel does not read. Defined here rather
  // than in vercel.json so they belong to the app and not to whoever hosts it.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(self)' },
        ],
      },
    ];
  },
  images: {
    // Street View / Places imagery + Supabase storage
    remotePatterns: [
      { protocol: 'https', hostname: 'maps.googleapis.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

module.exports = nextConfig;
