/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'localhost' },
      { protocol: 'https', hostname: 'genumsolutions-website.vercel.app' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'bkylfnlybtsujwzropru.supabase.co' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    return [
      { source: '/robot-cars', destination: '/projects', permanent: true },
      { source: '/training', destination: '/services#training', permanent: true },
      { source: '/products/esp32-car', destination: '/products/esp32-bluetooth-robot-car', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          // CSP tuned for the Android WebView: 'unsafe-inline' is required for
          // Next.js hydration scripts and inlined critical CSS. eSewa is reached
          // by a client-side POST form (form-action); Khalti and Google OAuth use
          // full-page top-level navigations, which CSP does not block. Supabase
          // must stay reachable for auth, storage images and the public store API.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://bkylfnlybtsujwzropru.supabase.co https://*.supabase.co https://images.unsplash.com http://localhost https://localhost",
              "font-src 'self' data:",
              "connect-src 'self' https://bkylfnlybtsujwzropru.supabase.co https://*.supabase.co http://localhost https://localhost",
              "frame-src 'self' https://www.google.com https://accounts.google.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://*.esewa.com.np https://epay.esewa.com.np https://uat.esewa.com.np",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default nextConfig