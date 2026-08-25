/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    domains: ['localhost', 'genumsolutions-website.vercel.app', 'images.unsplash.com', 'bkylfnlybtsujwzropru.supabase.co'],
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