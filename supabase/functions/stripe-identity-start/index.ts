import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createServiceClient, requireUser } from "../_shared/supabase.ts";
import {
  createStripeVerificationSession,
  retrieveStripeVerificationSession,
  sanitizeStripeReturnUrl,
  updateSafetyFromStripeSession,
  updateSafetyWithStripeStart,
} from "../_shared/stripeIdentity.ts";

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function persistSafetySettings(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  safetySettings: Record<string, unknown>,
  now: string
) {
  const { error } = await service
    .from("profiles")
    .update({
      safety_settings: safetySettings,
      updated_at: now,
    })
    .eq("id", userId);

  if (error) throw error;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const { user, errorResponse } = await requireUser(req);
  if (errorResponse || !user) {
    return errorResponse!;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const returnUrl = sanitizeStripeReturnUrl(asString(asObject(body).returnUrl));
    const service = createServiceClient();
    const { data: profile, error } = await service
      .from("profiles")
      .select("id, full_name, safety_settings")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (!profile) {
      return jsonResponse({ error: "Profile not found." }, 404);
    }

    const safetySettings = asObject(profile.safety_settings);
    const existingStripeState = asObject(safetySettings.stripe_identity);
    const existingSessionId = asString(existingStripeState.sessionId);
    const now = new Date().toISOString();

    if (existingSessionId) {
      try {
        const existingSession = await retrieveStripeVerificationSession(existingSessionId);
        const nextSafety = updateSafetyFromStripeSession(safetySettings, existingSession, now);
        const shouldReuseSession =
          existingSession.status === "verified" ||
          existingSession.status === "processing" ||
          (existingSession.status === "requires_input" && !!existingSession.url);

        if (shouldReuseSession) {
          await persistSafetySettings(service, user.id, nextSafety, now);
          return jsonResponse({
            success: true,
            reusedSession: true,
            status: existingSession.status,
            redirectUrl: existingSession.url ?? null,
            sessionId: existingSession.id,
            safetySettings: nextSafety,
          });
        }
      } catch (existingSessionError) {
        console.warn("stripe-identity-start could not reuse previous session:", existingSessionError);
      }
    }

    const fullName =
      asString(profile.full_name) ??
      asString(asObject(user.user_metadata).full_name) ??
      asString(asObject(user.user_metadata).name);

    const session = await createStripeVerificationSession({
      userId: user.id,
      fullName,
      returnUrl,
    });

    const nextSafety = updateSafetyWithStripeStart(safetySettings, session, now);
    await persistSafetySettings(service, user.id, nextSafety, now);

    return jsonResponse({
      success: true,
      reusedSession: false,
      status: session.status,
      redirectUrl: session.url ?? null,
      sessionId: session.id,
      safetySettings: nextSafety,
    });
  } catch (error) {
    console.error("stripe-identity-start failed:", error);
    return jsonResponse(
      { error: (error as Error)?.message || "Could not start Stripe Identity verification." },
      500
    );
  }
});
