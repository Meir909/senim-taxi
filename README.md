# Senim Taxi

Senim is a taxi platform focused on women drivers and safe rides for children, with live ride tracking, SOS, child tariffs, pickup/dropoff PINs, and driver verification.

## Stack

- TanStack Start + React 19
- Supabase
- Tailwind CSS
- Bun

## Local development

```bash
bun install
bun run dev
```

## Quality checks

```bash
bun run lint
bun run typecheck
bun run build
```

## Vercel deploy

The project is prepared for Vercel with `vercel.json` and a dedicated build script:

```bash
bun run build:vercel
```

Required environment variables should be added in Vercel Project Settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWOGIS_MAPGL_API_KEY`
- `LOVABLE_API_KEY`

If you use additional Supabase auth or storage settings locally, mirror them in Vercel before production deploy.
