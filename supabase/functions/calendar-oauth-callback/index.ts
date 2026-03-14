import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  exchangeCodeForTokens,
  fetchProviderAccountEmail,
  getAppSiteUrl,
  type Provider,
} from "../_shared/calendarProviders.ts";
import { parseSignedState } from "../_shared/oauthState.ts";
import { createServiceClient } from "../_shared/supabase.ts";

type StatePayload = {
  provider: Provider;
  userId: string;
  returnPath: string;
  ts: number;
  v: 1;
};

const STATE_TTL_MS = 20 * 60 * 1000;

const sanitizeReturnPath = (value: unknown) => {
  if (typeof value !== "string") return "/calendar";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return "/calendar";
  if (trimmed.startsWith("//")) return "/calendar";
  return trimmed;
};

const buildAppRedirect = (returnPath: string, params: Record<string, string>) => {
  const base = getAppSiteUrl().replace(/\/+$/, "");
  const redirectUrl = new URL(`${base}${sanitizeReturnPath(returnPath)}`);
  Object.entries(params).forEach(([key, value]) => {
    redirectUrl.searchParams.set(key, value);
  });
  return redirectUrl.toString();
};

const redirect = (location: string) =>
  new Response(null, {
    status: 302,
    headers: { Location: location },
  });

const sanitizeReason = (value: unknown, fallback = "callback_failed") => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._:-]/g, "");
  if (!normalized) return fallback;
  return normalized.slice(0, 180);
};

serve(async (req) => {
  let providerForRedirect: Provider | "google" | "outlook" = "google";
  let returnPathForRedirect = "/calendar";

  try {
    const url = new URL(req.url);
    const stateRaw = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const oauthError = url.searchParams.get("error");
    const oauthErrorDescription = url.searchParams.get("error_description");

    let state: StatePayload | null = null;
    if (stateRaw) {
      try {
        state = await parseSignedState<StatePayload>(stateRaw);
      } catch (error) {
        console.error("calendar-oauth-callback state parse failed:", error);
      }
    }

    const provider = state?.provider || "google";
    const returnPath = sanitizeReturnPath(state?.returnPath);
    providerForRedirect = provider;
    returnPathForRedirect = returnPath;

    if (!state || state.v !== 1 || Date.now() - state.ts > STATE_TTL_MS) {
      return redirect(
        buildAppRedirect(returnPath, {
          calendar_connect: "error",
          provider,
          reason: "invalid_or_expired_state",
        })
      );
    }

    if (oauthError) {
      return redirect(
        buildAppRedirect(returnPath, {
          calendar_connect: "error",
          provider,
          reason: oauthErrorDescription || oauthError,
        })
      );
    }

    if (!code) {
      return redirect(
        buildAppRedirect(returnPath, {
          calendar_connect: "error",
          provider,
          reason: "missing_oauth_code",
        })
      );
    }

    const service = createServiceClient();
    const tokens = await exchangeCodeForTokens(provider, code);
    const providerAccountEmail = await fetchProviderAccountEmail(provider, tokens.access_token);

    const { data: existingConnection } = await service
      .from("calendar_connections")
      .select("refresh_token")
      .eq("user_id", state.userId)
      .eq("provider", provider)
      .maybeSingle();

    const expiresAt =
      tokens.expires_in && tokens.expires_in > 0
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null;

    const refreshToken = tokens.refresh_token || existingConnection?.refresh_token || null;

    const { error: upsertError } = await service.from("calendar_connections").upsert(
      {
        user_id: state.userId,
        provider,
        provider_account_email: providerAccountEmail,
        provider_calendar_id: "primary",
        access_token: tokens.access_token,
        refresh_token: refreshToken,
        token_type: tokens.token_type || null,
        scope: tokens.scope || null,
        expires_at: expiresAt,
      },
      { onConflict: "user_id,provider" }
    );

    if (upsertError) throw upsertError;

    return redirect(
      buildAppRedirect(returnPath, {
        calendar_connect: "success",
        provider,
      })
    );
  } catch (error) {
    console.error("calendar-oauth-callback failed:", error);
    return redirect(
      buildAppRedirect(returnPathForRedirect, {
        calendar_connect: "error",
        provider: providerForRedirect,
        reason: sanitizeReason((error as Error)?.message),
      })
    );
  }
});
