import { supabase } from "@/lib/supabase";
import {
  DEFAULT_DISCOVER_FILTERS,
  type DiscoverFilters,
  normalizeDiscoverFilters,
} from "@/lib/discoverFilters";

export type ProfileRow = {
  id: string;
  full_name: string | null;
  username?: string | null;
  bio: string | null;
  location: string | null;
  photos: string[] | null;
  avatar_url?: string | null;
  profile_photo?: string | null;
  profile_completed: boolean | null;
  birthdate?: string | null;
  interests?: string[] | null;
  gender_identity?: string | null;
  sexual_orientation?: string | null;
  privacy_settings?: Record<string, any> | null;
  safety_settings?: Record<string, any> | null;
  lifestyle_interests?: Record<string, any> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type MatchingPreferences = {
  showMeOnPride: boolean;
  prioritizeVerified: boolean;
  hideAlreadySeen: boolean;
};

type ViewerSafetyPreferences = {
  requireVerification: boolean;
};

const DEFAULT_MATCHING_PREFERENCES: MatchingPreferences = {
  showMeOnPride: true,
  prioritizeVerified: false,
  hideAlreadySeen: true,
};

type DiscoverProfileRowRaw = ProfileRow & {
  updated_at?: string | null;
  birthdate?: string | null;
  privacy_settings?: Record<string, any> | null;
  safety_settings?: Record<string, any> | null;
  lifestyle_interests?: Record<string, any> | null;
};

type DemoProfilesPayload = {
  seed_profiles?: unknown;
};

const LOCAL_DEMO_PROFILE_LABEL = "Founding Community Member";
let localDemoProfilesPromise: Promise<ProfileRow[]> | null = null;

function shouldUseLocalDemoProfiles() {
  if (import.meta.env.VITE_ENABLE_LOCAL_DEMO_PROFILES === "true") return true;
  return import.meta.env.DEV;
}

function coerceStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.map((entry) => `${entry ?? ""}`.trim()).filter(Boolean);
}

function normalizeDemoProfile(raw: any): ProfileRow {
  const privacy =
    raw?.privacy_settings && typeof raw.privacy_settings === "object"
      ? (raw.privacy_settings as Record<string, any>)
      : {};
  const safety =
    raw?.safety_settings && typeof raw.safety_settings === "object"
      ? (raw.safety_settings as Record<string, any>)
      : {};
  const lifestyle =
    raw?.lifestyle_interests && typeof raw.lifestyle_interests === "object"
      ? (raw.lifestyle_interests as Record<string, any>)
      : {};
  const photos = coerceStringArray(raw?.photos);
  const avatarUrl =
    typeof raw?.avatar_url === "string"
      ? raw.avatar_url
      : typeof raw?.profile_photo === "string"
        ? raw.profile_photo
        : photos[0] ?? null;
  const normalizedPhotos = photos.length > 0 ? photos : avatarUrl ? [avatarUrl] : [];

  return {
    id: `${raw?.id ?? ""}`.trim(),
    full_name: typeof raw?.full_name === "string" ? raw.full_name : null,
    username: typeof raw?.username === "string" ? raw.username : null,
    bio: typeof raw?.bio === "string" ? raw.bio : null,
    location: typeof raw?.location === "string" ? raw.location : null,
    photos: normalizedPhotos,
    avatar_url: avatarUrl,
    profile_photo: avatarUrl,
    profile_completed: raw?.profile_completed !== false,
    birthdate: typeof raw?.birthdate === "string" ? raw.birthdate : null,
    interests: coerceStringArray(raw?.interests),
    gender_identity: typeof raw?.gender_identity === "string" ? raw.gender_identity : null,
    sexual_orientation:
      typeof raw?.sexual_orientation === "string" ? raw.sexual_orientation : null,
    privacy_settings: {
      demo_profile: true,
      demo_label: LOCAL_DEMO_PROFILE_LABEL,
      conversation_starter:
        typeof raw?.conversation_starter === "string" ? raw.conversation_starter : undefined,
      vibe_prompt: typeof raw?.vibe_prompt === "string" ? raw.vibe_prompt : undefined,
      demo_activity: typeof raw?.demo_activity === "string" ? raw.demo_activity : undefined,
      ...privacy,
    },
    safety_settings: {
      seeded_demo_profile: true,
      ...safety,
    },
    lifestyle_interests: lifestyle,
    created_at: typeof raw?.created_at === "string" ? raw.created_at : null,
    updated_at:
      typeof raw?.updated_at === "string"
        ? raw.updated_at
        : typeof raw?.last_active_at === "string"
          ? raw.last_active_at
          : null,
  };
}

function toDiscoverProfile(row: DiscoverProfileRowRaw): ProfileRow {
  const avatarUrl =
    row.avatar_url ?? row.profile_photo ?? row.photos?.[0] ?? null;
  const normalizedPhotos = row.photos?.length ? row.photos : avatarUrl ? [avatarUrl] : [];

  return {
    id: row.id,
    full_name: row.full_name,
    username: row.username ?? null,
    bio: row.bio,
    location: row.privacy_settings?.showDistance === false ? null : row.location,
    photos: normalizedPhotos,
    avatar_url: avatarUrl,
    profile_photo: avatarUrl,
    profile_completed: row.profile_completed,
    birthdate: row.privacy_settings?.showAge === false ? null : row.birthdate ?? null,
    interests: row.interests ?? [],
    gender_identity: row.gender_identity ?? null,
    sexual_orientation: row.sexual_orientation ?? null,
    privacy_settings: row.privacy_settings ?? null,
    safety_settings: row.safety_settings ?? null,
    lifestyle_interests: row.lifestyle_interests ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export function isDemoProfile(
  profile:
    | {
        privacy_settings?: Record<string, any> | null;
        privacy?: Record<string, any> | null;
        safety_settings?: Record<string, any> | null;
        safety?: Record<string, any> | null;
      }
    | null
    | undefined
) {
  if (!profile) return false;

  const privacy =
    (profile.privacy_settings && typeof profile.privacy_settings === "object"
      ? profile.privacy_settings
      : null) ??
    (profile.privacy && typeof profile.privacy === "object" ? profile.privacy : null);
  const safety =
    (profile.safety_settings && typeof profile.safety_settings === "object"
      ? profile.safety_settings
      : null) ??
    (profile.safety && typeof profile.safety === "object" ? profile.safety : null);

  return privacy?.demo_profile === true || safety?.seeded_demo_profile === true;
}

export function getPrimaryProfilePhoto(
  profile:
    | {
        photos?: string[] | null;
        avatar_url?: string | null;
        profile_photo?: string | null;
      }
    | null
    | undefined
) {
  if (!profile) return null;

  const photoFromArray =
    Array.isArray(profile.photos) && typeof profile.photos[0] === "string"
      ? profile.photos[0]
      : null;
  const avatarUrl = typeof profile.avatar_url === "string" ? profile.avatar_url : null;
  const profilePhoto = typeof profile.profile_photo === "string" ? profile.profile_photo : null;

  return photoFromArray || avatarUrl || profilePhoto || null;
}

export function getDemoProfileLabel(
  profile:
    | {
        privacy_settings?: Record<string, any> | null;
        privacy?: Record<string, any> | null;
      }
    | null
    | undefined
) {
  if (!profile) return LOCAL_DEMO_PROFILE_LABEL;

  const privacy =
    (profile.privacy_settings && typeof profile.privacy_settings === "object"
      ? profile.privacy_settings
      : null) ??
    (profile.privacy && typeof profile.privacy === "object" ? profile.privacy : null);
  const label = typeof privacy?.demo_label === "string" ? privacy.demo_label.trim() : "";
  return label || LOCAL_DEMO_PROFILE_LABEL;
}

export function getDemoConversationStarter(
  profile:
    | {
        privacy_settings?: Record<string, any> | null;
        privacy?: Record<string, any> | null;
      }
    | null
    | undefined
) {
  if (!profile) return null;

  const privacy =
    (profile.privacy_settings && typeof profile.privacy_settings === "object"
      ? profile.privacy_settings
      : null) ??
    (profile.privacy && typeof profile.privacy === "object" ? profile.privacy : null);
  const starter =
    typeof privacy?.conversation_starter === "string" ? privacy.conversation_starter.trim() : "";
  return starter || null;
}

export function getDemoVibePrompt(
  profile:
    | {
        privacy_settings?: Record<string, any> | null;
        privacy?: Record<string, any> | null;
      }
    | null
    | undefined
) {
  if (!profile) return null;

  const privacy =
    (profile.privacy_settings && typeof profile.privacy_settings === "object"
      ? profile.privacy_settings
      : null) ??
    (profile.privacy && typeof profile.privacy === "object" ? profile.privacy : null);
  const prompt = typeof privacy?.vibe_prompt === "string" ? privacy.vibe_prompt.trim() : "";
  return prompt || null;
}

export function getDemoActivityStatus(
  profile:
    | {
        privacy_settings?: Record<string, any> | null;
        privacy?: Record<string, any> | null;
      }
    | null
    | undefined
) {
  if (!profile) return null;

  const privacy =
    (profile.privacy_settings && typeof profile.privacy_settings === "object"
      ? profile.privacy_settings
      : null) ??
    (profile.privacy && typeof profile.privacy === "object" ? profile.privacy : null);
  const activity = typeof privacy?.demo_activity === "string" ? privacy.demo_activity.trim() : "";
  return activity || null;
}

export function getDemoVibeTags(
  profile:
    | {
        privacy_settings?: Record<string, any> | null;
        privacy?: Record<string, any> | null;
      }
    | null
    | undefined
) {
  if (!profile) return [] as string[];

  const privacy =
    (profile.privacy_settings && typeof profile.privacy_settings === "object"
      ? profile.privacy_settings
      : null) ??
    (profile.privacy && typeof profile.privacy === "object" ? profile.privacy : null);
  return coerceStringArray(privacy?.vibe_tags).slice(0, 4);
}

export async function fetchLocalDemoProfiles() {
  if (!shouldUseLocalDemoProfiles()) return [] as ProfileRow[];
  if (!localDemoProfilesPromise) {
    localDemoProfilesPromise = fetch("/demo/seed_profiles.ready.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Local demo profiles unavailable (${response.status})`);
        }
        return (await response.json()) as DemoProfilesPayload;
      })
      .then((payload) => {
        const rows = Array.isArray(payload?.seed_profiles) ? payload.seed_profiles : [];
        return rows
          .map((row) => normalizeDemoProfile(row))
          .filter((row) => Boolean(row.id) && row.profile_completed === true);
      })
      .catch((error) => {
        console.warn("Could not load local demo profiles.", error);
        return [] as ProfileRow[];
      });
  }

  return await localDemoProfilesPromise;
}

export async function findLocalDemoProfileById(id: string) {
  if (!id) return null;
  const profiles = await fetchLocalDemoProfiles();
  return profiles.find((profile) => profile.id === id) ?? null;
}

const isTruthy = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

async function loadMyMatchingPreferences(myId: string): Promise<MatchingPreferences> {
  const { data, error } = await supabase
    .from("profiles")
    .select("privacy_settings")
    .eq("id", myId)
    .maybeSingle();

  if (error) {
    console.warn("Could not load matching preferences. Falling back to defaults.", error.message);
    return { ...DEFAULT_MATCHING_PREFERENCES };
  }

  const privacy =
    data?.privacy_settings && typeof data.privacy_settings === "object"
      ? (data.privacy_settings as Record<string, any>)
      : {};
  const matching =
    privacy.matching && typeof privacy.matching === "object"
      ? (privacy.matching as Record<string, any>)
      : {};

  return {
    showMeOnPride: isTruthy(matching.showMeOnPride, DEFAULT_MATCHING_PREFERENCES.showMeOnPride),
    prioritizeVerified: isTruthy(
      matching.prioritizeVerified,
      DEFAULT_MATCHING_PREFERENCES.prioritizeVerified
    ),
    hideAlreadySeen: isTruthy(matching.hideAlreadySeen, DEFAULT_MATCHING_PREFERENCES.hideAlreadySeen),
  };
}

async function loadMySafetyPreferences(myId: string): Promise<ViewerSafetyPreferences> {
  const { data, error } = await supabase
    .from("profiles")
    .select("safety_settings")
    .eq("id", myId)
    .maybeSingle();

  if (error) {
    console.warn("Could not load safety preferences. Falling back to defaults.", error.message);
    return { requireVerification: false };
  }

  const safety =
    data?.safety_settings && typeof data.safety_settings === "object"
      ? (data.safety_settings as Record<string, any>)
      : {};

  return {
    requireVerification: safety.requireVerification === true,
  };
}

async function loadMyDiscoverFilters(myId: string): Promise<DiscoverFilters> {
  const { data, error } = await supabase
    .from("profiles")
    .select("privacy_settings")
    .eq("id", myId)
    .maybeSingle();

  if (error) {
    console.warn("Could not load discover filters. Falling back to defaults.", error.message);
    return { ...DEFAULT_DISCOVER_FILTERS };
  }

  const privacy =
    data?.privacy_settings && typeof data.privacy_settings === "object"
      ? (data.privacy_settings as Record<string, any>)
      : {};

  return normalizeDiscoverFilters(privacy.discoverFilters);
}

async function loadSeenIds(myId: string): Promise<Set<string>> {
  const seenIds = new Set<string>();

  const { data: likeRows, error: likeError } = await supabase
    .from("likes")
    .select("liked_id")
    .eq("liker_id", myId);
  if (!likeError) {
    (likeRows ?? []).forEach((row: any) => {
      if (typeof row.liked_id === "string") seenIds.add(row.liked_id);
    });
  } else {
    console.warn("Could not load seen profiles from likes.", likeError.message);
  }

  const { data: matchRows, error: matchError } = await supabase
    .from("matches")
    .select("user1_id, user2_id")
    .or(`user1_id.eq.${myId},user2_id.eq.${myId}`);
  if (!matchError) {
    (matchRows ?? []).forEach((row: any) => {
      if (row.user1_id && row.user1_id !== myId) seenIds.add(row.user1_id);
      if (row.user2_id && row.user2_id !== myId) seenIds.add(row.user2_id);
    });
  } else {
    console.warn("Could not load seen profiles from matches.", matchError.message);
  }

  return seenIds;
}

function calcAgeFromBirthdate(birthdate?: string | null) {
  if (!birthdate) return null;
  const d = new Date(birthdate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function normalizeToken(v: unknown) {
  return `${v ?? ""}`.trim().toLowerCase();
}

function flattenLifestyleStrings(lifestyle: Record<string, any> | null | undefined) {
  if (!lifestyle || typeof lifestyle !== "object") return [] as string[];

  const values: string[] = [];
  for (const raw of Object.values(lifestyle)) {
    if (Array.isArray(raw)) {
      raw.forEach((entry) => values.push(`${entry ?? ""}`));
    } else if (typeof raw === "string") {
      values.push(raw);
    }
  }
  return values;
}

function collectProfileInterestTokens(row: DiscoverProfileRowRaw) {
  const tokens = new Set<string>();

  const addToken = (value: string) => {
    const normalized = normalizeToken(value);
    if (!normalized) return;
    tokens.add(normalized);
  };

  (row.interests ?? []).forEach((entry) => {
    const raw = `${entry ?? ""}`.trim();
    if (!raw) return;
    addToken(raw);
    if (raw.includes(":")) {
      addToken(raw.split(":").slice(1).join(":"));
    }
  });

  flattenLifestyleStrings(row.lifestyle_interests).forEach((entry) => addToken(entry));
  return tokens;
}

function inferPronouns(row: DiscoverProfileRowRaw) {
  const pronouns = new Set<string>();

  const add = (value: string) => {
    const normalized = normalizeToken(value);
    if (!normalized) return;
    pronouns.add(normalized);
  };

  const identity = normalizeToken(row.gender_identity);
  if (identity.includes("woman") || identity.includes("female") || identity.includes("she")) {
    add("she/her");
  }
  if (
    identity.includes("non-binary") ||
    identity.includes("nonbinary") ||
    identity.includes("genderfluid") ||
    identity.includes("they")
  ) {
    add("they/them");
  }
  if (identity.includes("man") || identity.includes("male") || identity.includes("he")) {
    add("he/him");
  }

  flattenLifestyleStrings(row.lifestyle_interests).forEach((entry) => {
    const normalized = normalizeToken(entry);
    if (normalized.includes("she/her")) add("she/her");
    if (normalized.includes("they/them")) add("they/them");
    if (normalized.includes("he/him")) add("he/him");
  });

  return pronouns;
}

function deriveLookingForTags(row: DiscoverProfileRowRaw) {
  const tags = new Set<string>();
  const terms = collectProfileInterestTokens(row);

  const relationshipItems = Array.isArray(row.lifestyle_interests?.Relationship)
    ? (row.lifestyle_interests?.Relationship as string[])
    : [];
  const relationship = relationshipItems.map((entry) => normalizeToken(entry));

  if (
    relationship.some((r) =>
      ["exploring", "open to both", "polyamorous"].some((needle) => r.includes(needle))
    ) ||
    terms.has("dating")
  ) {
    tags.add("casual");
  }

  if (
    relationship.some((r) => r.includes("monogamous")) ||
    terms.has("relationship")
  ) {
    tags.add("serious");
  }

  if (
    ["support groups", "book clubs", "coffee dates", "queer meetups", "volunteering", "mentoring"].some(
      (v) => terms.has(v)
    )
  ) {
    tags.add("friends");
  }

  if (["networking", "community organizing", "entrepreneurship"].some((v) => terms.has(v))) {
    tags.add("networking");
  }

  return tags;
}

export async function fetchDiscoverProfiles(
  myId: string,
  options?: {
    includeLocalDemo?: boolean;
  }
) {
  const matchingPrefs = await loadMyMatchingPreferences(myId);
  const safetyPrefs = await loadMySafetyPreferences(myId);
  const discoverFilters = await loadMyDiscoverFilters(myId);

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, username, full_name, bio, location, photos, avatar_url, profile_completed, birthdate, interests, gender_identity, sexual_orientation, updated_at, privacy_settings, safety_settings, lifestyle_interests"
    )
    .neq("id", myId)
    .eq("profile_completed", true)
    .order("updated_at", { ascending: false })
    .limit(120);

  if (error) throw error;

  let rows = (data ?? []) as DiscoverProfileRowRaw[];

  // Respect each user's discoverability toggle. Missing setting defaults to visible.
  rows = rows.filter((row) => {
    const privacy = row.privacy_settings && typeof row.privacy_settings === "object"
      ? (row.privacy_settings as Record<string, any>)
      : {};
    const matching = row.privacy_settings?.matching;
    if (privacy.profileDiscoverable === false) return false;
    if (privacy.hideFromSearch === true) return false;
    if (privacy.incognitoMode === true) return false;
    if (matching && typeof matching === "object" && matching.showMeOnPride === false) return false;
    return true;
  });

  rows = rows.filter((row) => {
    const age = calcAgeFromBirthdate(row.birthdate);
    const [minAge, maxAge] = discoverFilters.ageRange;
    if (age != null && (age < minAge || age > maxAge)) return false;

    const selectedInterests = discoverFilters.interests.map((v) => normalizeToken(v));
    if (selectedInterests.length > 0) {
      const availableTokens = collectProfileInterestTokens(row);
      const hasMatch = selectedInterests.some((selected) => availableTokens.has(selected));
      if (!hasMatch) return false;
    }

    const pronounFilters = discoverFilters.pronouns
      .filter((p) => p !== "Any")
      .map((p) => normalizeToken(p));
    if (pronounFilters.length > 0) {
      const profilePronouns = inferPronouns(row);
      const pronounMatch = pronounFilters.some((p) => profilePronouns.has(p));
      if (!pronounMatch) return false;
    }

    const lookingForFilters = discoverFilters.lookingFor.map((v) => normalizeToken(v));
    if (lookingForFilters.length > 0) {
      const profileTags = deriveLookingForTags(row);
      const lookingForMatch = lookingForFilters.some((selected) => profileTags.has(selected));
      if (!lookingForMatch) return false;
    }

    const distanceValue = Number(
      (row.lifestyle_interests as any)?.distance_miles ??
        (row.lifestyle_interests as any)?.distanceMiles ??
        NaN
    );
    if (Number.isFinite(distanceValue) && distanceValue > discoverFilters.distanceMiles) {
      return false;
    }

    return true;
  });

  if (safetyPrefs.requireVerification) {
    rows = rows.filter((row) => row.safety_settings?.photoVerification === true);
  }

  if (matchingPrefs.hideAlreadySeen) {
    const seenIds = await loadSeenIds(myId);
    rows = rows.filter((row) => !seenIds.has(row.id));
  }

  if (matchingPrefs.prioritizeVerified) {
    rows.sort((a, b) => {
      const aVerified = a.safety_settings?.photoVerification === true ? 1 : 0;
      const bVerified = b.safety_settings?.photoVerification === true ? 1 : 0;
      if (aVerified !== bVerified) return bVerified - aVerified;

      const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bTime - aTime;
    });
  }

  const databaseProfiles = rows.slice(0, 50).map((row) => toDiscoverProfile(row));
  if (!options?.includeLocalDemo) return databaseProfiles;

  const demoProfiles = await fetchLocalDemoProfiles();
  if (demoProfiles.length === 0) return databaseProfiles;

  const seenIds = new Set(databaseProfiles.map((profile) => profile.id));
  const mergedProfiles = [...databaseProfiles];

  for (const demoProfile of demoProfiles) {
    if (mergedProfiles.length >= 50) break;
    if (!demoProfile.id || demoProfile.id === myId || seenIds.has(demoProfile.id)) continue;
    seenIds.add(demoProfile.id);
    mergedProfiles.push(demoProfile);
  }

  return mergedProfiles;
}
