import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import seedData from '../data/seed_profiles.json' with { type: 'json' };
import { ensureSeedAuthUsers, slugToUsername } from './seed-auth-users.js';
import { resolveSeedPhotoPath } from './seed-photo.js';

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env.seed' });

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const table = process.env.SUPABASE_TABLE || 'profiles';

if (!url || !key) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in your .env file');
}

const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function deriveBirthdate(age: number) {
  const today = new Date();
  const year = today.getUTCFullYear() - age;
  return `${year}-06-15`;
}

async function run() {
  const now = new Date().toISOString();
  const authUsers = await ensureSeedAuthUsers(supabase as any, seedData.seed_profiles);
  const rows = seedData.seed_profiles.map((profile) => {
    const photoPath = resolveSeedPhotoPath(profile.slug);
    const authUser = authUsers.get(profile.slug);

    if (!authUser?.id) {
      throw new Error(`Missing seeded auth user for ${profile.slug}`);
    }

    return {
      id: authUser.id,
      full_name: profile.name,
      display_name: profile.name,
      username: slugToUsername(profile.slug),
      bio: profile.bio,
      location: profile.location,
      occupation: null,
      birthdate: deriveBirthdate(profile.age),
      gender_identity: profile.presentation,
      sexual_orientation: profile.identity,
      interests: profile.interests,
      photos: [photoPath],
      avatar_url: photoPath,
      lifestyle_interests: {
        pride_pins: [],
        vibe_tags: profile.vibe_tags,
        demo_profile: true,
      },
      profile_completed: true,
      privacy_settings: {
        demo_profile: true,
        demo_label: profile.demo_label,
        profileDiscoverable: true,
        hideFromSearch: false,
        intentions: profile.intentions,
        pronouns: profile.pronouns,
        vibe_tags: profile.vibe_tags,
        conversation_starter: profile.conversation_starter,
        seeded_demo_email: authUser.email,
      },
      safety_settings: {
        seeded_demo_profile: true,
        photoVerification: true,
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
