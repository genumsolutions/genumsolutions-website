export const company = {
  name: 'GENUM SOLUTIONS PVT. LTD.',
  shortName: 'GENUM SOLUTIONS',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  address: 'Shringhkhala Galli-32, Kathmandu, Nepal',
  city: 'Kathmandu',
  country: 'NP',
  email: 'genumsolutions@gmail.com',
  phone: '+977 9861842552',
  pan: '623676190',
  vatLabel: 'PAN registered',
  description: 'Robotics, electronics, 3D printing, AI, IoT, digital products, and practical technology training from Kathmandu, Nepal.',
}

// Single source of truth for the downloadable Android app. Keep the release
// constants in sync with mobile/app.json, mobile/src/config/site.ts and
// mobile/scripts/upload-release.mjs on every release.
export const androidApp = {
  version: '1.5.2',
  versionCode: 10,
  sizeLabel: '32.5 MB',
  arch: 'Android · 64-bit',
  apkUrl:
    'https://bkylfnlybtsujwzropru.supabase.co/storage/v1/object/public/app-releases/genum-solutions-latest.apk',
  releaseUrl:
    'https://bkylfnlybtsujwzropru.supabase.co/storage/v1/object/public/app-releases/release.json',
  appsPagePath: '/app',
}
