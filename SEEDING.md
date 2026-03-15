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
3. Run:

```bash
npm run seed:supabase
```

## Notes

- This seed pack is a utility for this existing Vite/Capacitor app, not a separate Expo app.
- Demo profiles are marked with:
  - `seed_profile: true`
  - `demo_label: "Founding Community Demo"`
- The generated Supabase rows are mapped to this repo’s `profiles` schema and use deterministic UUIDs based on each demo slug so repeated seeding upserts cleanly.
