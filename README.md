# GENUM SOLUTIONS website

Next.js App Router website for GENUM SOLUTIONS PVT. LTD., covering robotics, electronics, AI, IoT, 3D printing, digital products, training, and client project delivery.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`. If that port is occupied, Next.js will report the alternate port in the terminal.

## Public areas

- `/products` contains retail products and source-derived robotics project configurations.
- `/training` contains the K–5 pilot, STEM Master Package, teacher enablement, 100+ project curriculum highlights, and illustrative proposal costing.
- `/services` describes client delivery, proposal stages, business scope, and starting package prices.
- `/portfolio` presents documented projects and robotics build paths.
- `/3d-printing` includes print services and an open model browser.
- `/tools` contains open-source CAD, electronics, firmware, simulation, and media resources.
- `/contact` sends inquiries through the server-side Resend integration.

## Environment

Copy `.env.example` to `.env.local` and add the Resend key before testing contact email delivery. Never commit `.env.local`, payment secrets, Wi-Fi credentials, or private proposal files.

## Validation

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
npm.cmd run build
```

Product imagery uses shared, category-specific public Unsplash image URLs in `lib/product-media.ts`; every catalog listing and detail page resolves through that map so new listings do not need duplicate binary assets.
