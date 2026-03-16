# Violets & Vibes Seed Bundle

This repo includes a seed utility for local demo content and optional Supabase seeding.

## Included files

- `data/seed_profiles.json`
- `data/photo_prompts.json`
- `scripts/generate-placeholders.ts`
- `scripts/seed-local.ts`
- `scripts/seed-supabase.ts`
- `tsconfig.seed.json`
- `.env.seed.example`

## Quick start

```bash
npm install
npm run generate:avatars
npm run seed:local
```

That will:

1. generate SVG avatars into `public/seed-avatars`
2. generate `public/demo/seed_profiles.ready.json`

## Supabase seed

1. Copy `.env.seed.example` to `.env.seed`
2. Fill in:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - optional `SUPABASE_TABLE`
   - optional `SEED_PROFILE_EMAIL_DOMAIN`
3. Run:

```bash
npm run seed:supabase
```

This seed path is auth-aware:

1. it creates or updates system-controlled users in `auth.users`
2. it upserts matching rows into `public.profiles`

That is required because `public.profiles.id` references `auth.users(id)`.

## Refresh seeded engagement

This repo includes a safe demo-engagement refresher. It rotates seeded profile activity,
conversation starters, and vibe prompts without writing fake likes, fake views, or fake
messages to real-user tables.

Local demo refresh:

```bash
npm run seed:refresh
```

Supabase demo refresh:

```bash
npm run seed:refresh -- --target=supabase
```

Refresh both local JSON and Supabase:

```bash
npm run seed:refresh -- --target=both
```

Optional daily cron example:

```bash
0 0 * * * cd /path/to/violetsandvibes && npm run seed:refresh -- --target=both
```

## GitHub Actions scheduler

This repo includes `.github/workflows/seed-refresh.yml` for a real scheduled refresh against a
dev or staging Supabase project.

Set these repository secrets before enabling it:

- `SEED_SUPABASE_URL`
- `SEED_SUPABASE_SERVICE_ROLE_KEY`

The workflow runs nightly and can also be triggered manually from GitHub Actions.

## Notes

- This seed pack is a utility for this existing Vite/Capacitor app, not a separate Expo app.
- Demo profiles are marked with:
  - `privacy_settings.demo_profile: true`
  - `safety_settings.seeded_demo_profile: true`
  - `demo_label: "Founding Community Demo"`
- The generated local JSON uses deterministic UUIDs for stable demo routing.
- The Supabase seed uses deterministic emails plus service-role-created auth users so repeated seeding updates the same system-controlled accounts cleanly.
- Demo engagement refresh is intentionally transparent and limited to demo-profile content.
  It does not fabricate real-user interactions.
