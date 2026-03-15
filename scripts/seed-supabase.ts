import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { v5 as uuidv5 } from 'uuid';
import seedData from '../data/seed_profiles.json' with { type: 'json' };

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env.seed' });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const table = process.env.SUPABASE_TABLE || 'profiles';
const namespace = 'a7be2314-b8cc-4a2a-a5f8-f4cb3721fd30';

if (!url || !key) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in your .env file');
}

const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function slugToUsername(slug: string) {
  return slug.replace(/[^a-z0-9_]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

function deriveBirthdate(age: number) {
  const today = new Date();
  const year = today.getUTCFullYear() - age;
  return `${year}-06-15`;
}

async function run() {
  const now = new Date().toISOString();
  const rows = seedData.seed_profiles.map((profile) => {
    const photoPath = `/seed-avatars/${profile.slug}.svg`;
    return {
      id: uuidv5(`vv-seed:${profile.slug}`, namespace),
      full_name: profile.name,
      username: slugToUsername(profile.slug),
      bio: profile.bio,
      location: profile.location,
      birthdate: deriveBirthdate(profile.age),
      gender_identity: profile.presentation,
      sexual_orientation: profile.identity,
      interests: profile.interests,
      photos: [photoPath],
      avatar_url: photoPath,
      profile_completed: true,
      privacy_settings: {
        demo_profile: true,
        demo_label: profile.demo_label,
        intentions: profile.intentions,
        pronouns: profile.pronouns,
        vibe_tags: profile.vibe_tags,
        conversation_starter: profile.conversation_starter,
      },
      safety_settings: {
        seeded_demo_profile: true,
      },
      created_at: now,
      updated_at: now,
    };
  });

  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error('Supabase seed failed:', error);
    process.exit(1);
  }

  console.log(`Upserted ${rows.length} profiles into ${table}`);
}

run();
