import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";
import seedData from "../data/seed_profiles.json" with { type: "json" };
import { ensureSeedAuthUsers, slugToUsername } from "./seed-auth-users.js";

type Target = "local" | "supabase" | "both";

const namespace = "a7be2314-b8cc-4a2a-a5f8-f4cb3721fd30";
const root = process.cwd();
const localOutputPath = path.join(root, "public", "demo", "seed_profiles.ready.json");
const rotationKey =
  process.env.SEED_ROTATION_KEY || new Date().toISOString().slice(0, 10).replace(/-/g, "");
const requestedTarget = (
  process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] || "local"
) as Target;
const target: Target = ["local", "supabase", "both"].includes(requestedTarget)
  ? requestedTarget
  : "local";

const now = new Date();
const starterPool = seedData.seed_profiles
  .map((profile) => profile.conversation_starter)
  .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
const vibePool = Array.from(
  new Set(
    seedData.seed_profiles.flatMap((profile) =>
      Array.isArray(profile.vibe_tags)
        ? profile.vibe_tags.filter((value): value is string => typeof value === "string")
        : []
    )
  )
);
const activityPool = [
  "Currently refreshing her profile and exploring new conversations.",
  "Open to a cozy coffee chat and nearby community events.",
  "Checking the social feed and planning something low-key this week.",
  "Looking for thoughtful conversation and a genuine first connection.",
  "Exploring circles, local events, and one good new conversation.",
  "Active in the community and open to intentional dating.",
  "In a social mood today and open to a warm first hello.",
  "Updating her vibe and checking out nearby women-centered events.",
];
const vibePromptTemplates = [
  (name: string, vibes: string[]) => `${name}'s vibe today: ${vibes.join(" • ")}`,
  (name: string, vibes: string[]) => `${name} is leaning into ${vibes.join(", ")} energy today.`,
  (_name: string, vibes: string[]) => `Current mood: ${vibes.join(" • ")}`,
  (name: string, vibes: string[]) => `Best opener for ${name} today: match the ${vibes[0]} energy.`,
];

function deriveBirthdate(age: number) {
  const year = now.getUTCFullYear() - age;
  return `${year}-06-15`;
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickDistinct(values: string[], count: number, seed: number, exclude: string[] = []) {
  const available = values.filter((value) => !exclude.includes(value));
  if (available.length === 0) return [] as string[];

  const picks: string[] = [];
  let cursor = seed;
  while (picks.length < count && picks.length < available.length) {
    const candidate = available[cursor % available.length];
    if (!picks.includes(candidate)) picks.push(candidate);
    cursor += 7;
  }
  return picks;
}

function buildEngagementState(profile: (typeof seedData.seed_profiles)[number]) {
  const seed = hashString(`${rotationKey}:${profile.slug}`);
  const photoPath = `/seed-avatars/${profile.slug}.svg`;
  const baseVibes = Array.isArray(profile.vibe_tags)
    ? profile.vibe_tags.filter((value): value is string => typeof value === "string")
    : [];
  const rotatedVibes = Array.from(
    new Set([
      ...baseVibes,
      ...pickDistinct(vibePool, 2, seed, baseVibes),
    ])
  ).slice(0, 4);
  const conversationStarter =
    starterPool[(seed + profile.slug.length) % starterPool.length] || profile.conversation_starter;
  const demoActivity = activityPool[seed % activityPool.length];
  const vibePrompt =
    vibePromptTemplates[seed % vibePromptTemplates.length](profile.name, rotatedVibes);
  const minutesAgo = 15 + (seed % (12 * 60));
  const lastActiveAt = new Date(now.getTime() - minutesAgo * 60 * 1000).toISOString();

  return {
    id: uuidv5(`vv-seed:${profile.slug}`, namespace),
    name: profile.name,
    age: profile.age,
    identity: profile.identity,
    presentation: profile.presentation,
    location: profile.location,
    bio: profile.bio,
    interests: profile.interests,
    conversation_starter: conversationStarter,
    vibe_tags: rotatedVibes,
    vibe_prompt: vibePrompt,
    demo_activity: demoActivity,
    slug: profile.slug,
    seed_profile: true,
    demo_label: profile.demo_label,
    profile_photo: photoPath,
    intentions: profile.intentions,
    pronouns: profile.pronouns,
    profile_status: "active",
    full_name: profile.name,
    username: slugToUsername(profile.slug),
    birthdate: deriveBirthdate(profile.age),
    sexual_orientation: profile.identity,
    gender_identity: profile.presentation,
    photos: [photoPath],
    avatar_url: photoPath,
    profile_completed: true,
    onboarding_complete: true,
    discoverable: true,
    last_active_at: lastActiveAt,
    privacy_settings: {
      demo_profile: true,
      demo_label: profile.demo_label,
      intentions: profile.intentions,
      pronouns: profile.pronouns,
      vibe_tags: rotatedVibes,
      conversation_starter: conversationStarter,
      vibe_prompt: vibePrompt,
      demo_activity: demoActivity,
      demo_rotation_key: rotationKey,
    },
    safety_settings: {
      seeded_demo_profile: true,
      demo_engagement_managed: true,
    },
    updated_at: lastActiveAt,
  };
}

async function writeLocalDemoProfiles() {
  const readyProfiles = seedData.seed_profiles.map((profile) => buildEngagementState(profile));
  fs.mkdirSync(path.dirname(localOutputPath), { recursive: true });
  fs.writeFileSync(
    localOutputPath,
    JSON.stringify({ seed_profiles: readyProfiles }, null, 2),
    "utf8"
  );
  console.log(`Refreshed local demo engagement for ${readyProfiles.length} profiles at ${localOutputPath}`);
}

async function refreshSupabaseDemoProfiles() {
  dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".env.seed" });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const table = process.env.SUPABASE_TABLE || "profiles";

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.seed");
  }

  const supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const authUsers = await ensureSeedAuthUsers(supabase as any, seedData.seed_profiles);
  const rows = seedData.seed_profiles.map((profile) => {
    const next = buildEngagementState(profile);
    const authUser = authUsers.get(profile.slug);

    if (!authUser?.id) {
      throw new Error(`Missing seeded auth user for ${profile.slug}`);
    }

    return {
      id: authUser.id,
      full_name: next.full_name,
      display_name: next.full_name,
      username: next.username,
      bio: next.bio,
      location: next.location,
      occupation: null,
      birthdate: next.birthdate,
      gender_identity: next.gender_identity,
      sexual_orientation: next.sexual_orientation,
      interests: next.interests,
      photos: next.photos,
      avatar_url: next.avatar_url,
      lifestyle_interests: {
        pride_pins: [],
        vibe_tags: next.vibe_tags,
        demo_profile: true,
      },
      profile_completed: true,
      privacy_settings: {
        ...next.privacy_settings,
        profileDiscoverable: true,
        hideFromSearch: false,
        seeded_demo_email: authUser.email,
      },
      safety_settings: {
        ...next.safety_settings,
        photoVerification: true,
      },
      updated_at: next.updated_at,
    };
  });

  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw error;

  console.log(`Refreshed Supabase demo engagement for ${rows.length} profiles in ${table}`);
}

async function run() {
  if (target === "local" || target === "both") {
    await writeLocalDemoProfiles();
  }

  if (target === "supabase" || target === "both") {
    await refreshSupabaseDemoProfiles();
  }
}

run().catch((error) => {
  console.error("Seed engagement refresh failed:", error);
  process.exit(1);
});
