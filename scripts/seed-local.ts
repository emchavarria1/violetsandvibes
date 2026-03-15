import fs from 'node:fs';
import path from 'node:path';
import seedData from '../data/seed_profiles.json' with { type: 'json' };

const root = process.cwd();
const outputDir = path.join(root, 'public', 'demo');
fs.mkdirSync(outputDir, { recursive: true });

function slugToUsername(slug: string) {
  return slug.replace(/[^a-z0-9_]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

function deriveBirthdate(age: number) {
  const today = new Date();
  const year = today.getUTCFullYear() - age;
  return `${year}-06-15`;
}

const readyProfiles = seedData.seed_profiles.map((profile) => {
  const photoPath = `/seed-avatars/${profile.slug}.svg`;
  return {
    ...profile,
    full_name: profile.name,
    username: slugToUsername(profile.slug),
    birthdate: deriveBirthdate(profile.age),
    sexual_orientation: profile.identity,
    gender_identity: profile.presentation,
    photos: [photoPath],
    avatar_url: photoPath,
    profile_photo: photoPath,
    profile_completed: true,
    onboarding_complete: true,
    discoverable: true,
    last_active_at: new Date().toISOString(),
    privacy_settings: {
      demo_profile: true,
      demo_label: profile.demo_label,
      intentions: profile.intentions,
      pronouns: profile.pronouns,
      vibe_tags: profile.vibe_tags,
    },
    safety_settings: {
      seeded_demo_profile: true,
    },
  };
});

const outPath = path.join(outputDir, 'seed_profiles.ready.json');
fs.writeFileSync(outPath, JSON.stringify({ seed_profiles: readyProfiles }, null, 2), 'utf8');

console.log(`Created ${readyProfiles.length} ready-to-use profiles at ${outPath}`);
