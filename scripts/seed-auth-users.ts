import crypto from "node:crypto";

type SupabaseAdminClient = {
  auth: {
    admin: {
      listUsers: (params?: { page?: number; perPage?: number }) => Promise<any>;
      createUser: (attributes: Record<string, any>) => Promise<any>;
      updateUserById: (id: string, attributes: Record<string, any>) => Promise<any>;
    };
  };
};

type SeedProfileInput = {
  slug: string;
  name: string;
};

const DEFAULT_SEED_EMAIL_DOMAIN = "seed.violetsandvibes.local";

export function getSeedEmailDomain() {
  return (process.env.SEED_PROFILE_EMAIL_DOMAIN || DEFAULT_SEED_EMAIL_DOMAIN).trim().toLowerCase();
}

export function slugToUsername(slug: string) {
  return slug.replace(/[^a-z0-9_]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

export function buildSeedProfileEmail(slug: string, domain = getSeedEmailDomain()) {
  return `seed+${slug}@${domain}`;
}

function buildSeedUserMetadata(profile: SeedProfileInput) {
  return {
    full_name: profile.name,
    username: slugToUsername(profile.slug),
    seeded_demo_profile: true,
    demo_slug: profile.slug,
  };
}

function buildSeedAppMetadata(profile: SeedProfileInput) {
  return {
    provider: "email",
    providers: ["email"],
    seeded_demo_profile: true,
    system_account: true,
    demo_slug: profile.slug,
  };
}

async function listAllAuthUsers(supabase: SupabaseAdminClient) {
  const users: any[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;

    const batch = Array.isArray(data?.users) ? data.users : [];
    users.push(...batch);

    if (!data?.nextPage || batch.length === 0) break;
    page = data.nextPage;
  }

  return users;
}

function createSeedPassword() {
  return `${crypto.randomBytes(24).toString("base64url")}Aa1!`;
}

export async function ensureSeedAuthUsers(
  supabase: SupabaseAdminClient,
  profiles: SeedProfileInput[]
) {
  const emailDomain = getSeedEmailDomain();
  const existingUsers = await listAllAuthUsers(supabase);
  const usersByEmail = new Map<string, any>();

  for (const user of existingUsers) {
    const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
    if (!email) continue;
    usersByEmail.set(email, user);
  }

  const resolvedUsers = new Map<string, { id: string; email: string }>();

  for (const profile of profiles) {
    const email = buildSeedProfileEmail(profile.slug, emailDomain);
    let user = usersByEmail.get(email);

    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: createSeedPassword(),
        email_confirm: true,
        user_metadata: buildSeedUserMetadata(profile),
        app_metadata: buildSeedAppMetadata(profile),
      });

      if (error || !data?.user?.id) {
        throw error || new Error(`Could not create seeded auth user for ${profile.slug}`);
      }

      user = data.user;
      usersByEmail.set(email, user);
    } else {
      const { error } = await supabase.auth.admin.updateUserById(user.id, {
        email_confirm: true,
        user_metadata: buildSeedUserMetadata(profile),
        app_metadata: buildSeedAppMetadata(profile),
      });

      if (error) {
        throw error;
      }
    }

    resolvedUsers.set(profile.slug, { id: user.id, email });
  }

  return resolvedUsers;
}
