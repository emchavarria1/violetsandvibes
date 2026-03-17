import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

type PackageProfile = {
  id?: string;
  name?: string;
  age?: number;
  orientation?: string;
  lookingFor?: string[];
  bio?: string;
  interests?: string[];
  vibe?: string;
  photoFile?: string;
  photoUrl?: string;
  isDemo?: boolean;
  isSeeded?: boolean;
  isVerified?: boolean;
  city?: string;
};

type PackagePayload = {
  profiles?: PackageProfile[];
};

type SeedProfile = {
  id: number;
  name: string;
  age: number;
  identity: string;
  presentation: string;
  location: string;
  bio: string;
  interests: string[];
  conversation_starter: string;
  vibe_tags: string[];
  slug: string;
  seed_profile: true;
  demo_label: string;
  profile_photo: string;
  photo_file: string | null;
  intentions: string[];
  pronouns: string[];
  profile_status: "active";
};

const zipPath = process.argv[2];

if (!zipPath) {
  throw new Error("Usage: tsx scripts/import-seed-package.ts /path/to/violets_vibes_seed_package.zip");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function deriveSlug(profile: PackageProfile, index: number) {
  const baseId = typeof profile.id === "string" ? profile.id.trim().replace(/^demo_/, "") : "";
  const baseName = typeof profile.name === "string" ? profile.name.trim() : `profile-${index + 1}`;
  return slugify(baseId || baseName || `profile-${index + 1}`) || `profile-${index + 1}`;
}

function deriveConversationStarter(profile: PackageProfile) {
  const firstInterest =
    Array.isArray(profile.interests) && profile.interests.length > 0
      ? String(profile.interests[0]).trim()
      : "";
  const vibe = typeof profile.vibe === "string" ? profile.vibe.trim() : "";

  if (firstInterest) {
    return `What about ${firstInterest.toLowerCase()} feels most like you?`;
  }

  if (vibe) {
    return `What does "${vibe}" look like for you in real life?`;
  }

  return "What kind of connection are you hoping to find here?";
}

function deriveVibeTags(profile: PackageProfile) {
  const vibe = typeof profile.vibe === "string" ? profile.vibe : "";
  const parts = vibe
    .split(/[,&/|]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(parts)).slice(0, 4);
}

function deriveLocation(profile: PackageProfile) {
  return typeof profile.city === "string" && profile.city.trim().length > 0
    ? profile.city.trim()
    : "Sacramento";
}

function deriveIntentions(profile: PackageProfile) {
  if (!Array.isArray(profile.lookingFor)) return ["community"];
  const normalized = profile.lookingFor
    .map((entry) => String(entry).trim().toLowerCase())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : ["community"];
}

function deriveIdentity(profile: PackageProfile) {
  return typeof profile.orientation === "string" ? profile.orientation.trim() : "";
}

function unzipPackage(sourceZip: string) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vv-seed-import-"));
  execFileSync("unzip", ["-oq", sourceZip, "-d", tmpDir]);
  return tmpDir;
}

function loadPackageProfiles(sourceZip: string) {
  const tmpDir = unzipPackage(sourceZip);
  const payload = JSON.parse(
    fs.readFileSync(path.join(tmpDir, "violets_vibes_seed_data.json"), "utf8")
  ) as PackagePayload;

  const profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
  if (profiles.length !== 50) {
    throw new Error(`Expected 50 profiles in package, found ${profiles.length}`);
  }

  return profiles;
}

const packageProfiles = loadPackageProfiles(zipPath);
const nextSeedProfiles: SeedProfile[] = packageProfiles.map((profile, index) => {
  const slug = deriveSlug(profile, index);
  const photoFile = typeof profile.photoFile === "string" ? profile.photoFile.trim() : null;

  return {
    id: index + 1,
    name: typeof profile.name === "string" ? profile.name.trim() : `Profile ${index + 1}`,
    age: typeof profile.age === "number" ? profile.age : 30,
    identity: deriveIdentity(profile),
    presentation: "",
    location: deriveLocation(profile),
    bio: typeof profile.bio === "string" ? profile.bio.trim() : "",
    interests: Array.isArray(profile.interests)
      ? profile.interests.map((entry) => String(entry).trim()).filter(Boolean)
      : [],
    conversation_starter: deriveConversationStarter(profile),
    vibe_tags: deriveVibeTags(profile),
    slug,
    seed_profile: true,
    demo_label: "Founding Community Member",
    profile_photo: photoFile ? `/seed-avatars/${photoFile}` : `/seed-avatars/${slug}.jpg`,
    photo_file: photoFile,
    intentions: deriveIntentions(profile),
    pronouns: [],
    profile_status: "active",
  };
});

const outPath = path.join(process.cwd(), "data", "seed_profiles.json");
fs.writeFileSync(outPath, JSON.stringify({ seed_profiles: nextSeedProfiles }, null, 2), "utf8");

console.log(`Imported ${nextSeedProfiles.length} profiles into ${outPath}`);
