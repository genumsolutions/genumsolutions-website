# GENUM CMS

Create a Strapi v5 project in this directory, then copy the API folders into `src/api`. The schemas below define the content contract consumed by the Next.js storefront.

## Local setup

```bash
npx create-strapi-app@latest . --quickstart
npm run develop
```

Set `NEXT_PUBLIC_STRAPI_URL=http://localhost:1337` in the frontend environment. Enable Public `find` permissions for Products, and protect create/update actions with Admin or Editor roles.

## Production

- PostgreSQL: set `DATABASE_CLIENT=postgres` and the standard `DATABASE_*` environment variables.
- DigitalOcean/AWS: deploy Strapi behind HTTPS and a managed PostgreSQL instance; configure object storage for uploads.
- Vercel: set `NEXT_PUBLIC_STRAPI_URL`, `NEXT_PUBLIC_SITE_URL`, and payment secrets in Project Settings.
- Stripe uses a server route with `STRIPE_SECRET_KEY`; Nepal gateways should use server-side signed callbacks and never expose secrets in the browser.
