import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { jsonResponse } from "./cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing required Supabase environment variables in Edge Function runtime.");
}

export const createServiceClient = () =>
  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

export const createAuthedClient = (authorizationHeader: string) =>
  (() => {
    if (!SUPABASE_ANON_KEY) {
      throw new Error("SUPABASE_ANON_KEY is missing in Edge Function runtime.");
    }
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authorizationHeader,
        },
      },
      auth: { autoRefreshToken: false, persistSession: false },
    });
  })();

export async function requireUser(req: Request): Promise<{
  user: User | null;
  errorResponse?: Response;
}> {
  const authHeader = req.headers.get("Authorization");
  const customAccessToken =
    req.headers.get("X-VV-Access-Token") || req.headers.get("x-vv-access-token");

  if (!authHeader && !customAccessToken) {
    return {
      user: null,
      errorResponse: jsonResponse({ error: "Missing access token" }, 401),
    };
  }

  const match = authHeader?.match(/^Bearer\s+(.+)$/i);
  const accessToken = match?.[1]?.trim() || customAccessToken?.trim() || null;

  if (!accessToken) {
    return {
      user: null,
      errorResponse: jsonResponse({ error: "Invalid access token format" }, 401),
    };
  }

  // Validate JWT with the service client to avoid anon-key/project drift
  // causing false "Invalid JWT" responses in edge runtime.
  const service = createServiceClient();
  const { data, error } = await service.auth.getUser(accessToken);
  if (error || !data.user) {
    return {
      user: null,
      errorResponse: jsonResponse({ error: error?.message || "Unauthorized" }, 401),
    };
  }

  return { user: data.user };
}
