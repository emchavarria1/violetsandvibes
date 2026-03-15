import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createServiceClient, requireUser } from "../_shared/supabase.ts";
import {
  retrieveStripeVerificationSession,
  updateSafetyFromStripeSession,
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
    const service = createServiceClient();
    const { data: profile, error } = await service
      .from("profiles")
      .select("id, safety_settings")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (!profile) {
      return jsonResponse({ error: "Profile not found." }, 404);
    }

    const safetySettings = asObject(profile.safety_settings);
    const stripeState = asObject(safetySettings.stripe_identity);
    const sessionId = asString(asObject(body).sessionId) ?? asString(stripeState.sessionId);

    if (!sessionId) {
      return jsonResponse({ error: "No Stripe verification session was found for this account." }, 400);
    }

    const session = await retrieveStripeVerificationSession(sessionId);
    const now = new Date().toISOString();
    const nextSafety = updateSafetyFromStripeSession(safetySettings, session, now);
    await persistSafetySettings(service, user.id, nextSafety, now);

    return jsonResponse({
      success: true,
      status: session.status,
      redirectUrl: session.url ?? null,
      sessionId: session.id,
      safetySettings: nextSafety,
      verified: nextSafety.photoVerification === true,
      rejectionReason: asString(nextSafety.verification_rejection_reason),
    });
  } catch (error) {
    console.error("stripe-identity-refresh failed:", error);
    return jsonResponse(
      { error: (error as Error)?.message || "Could not refresh Stripe Identity verification." },
      500
    );
  }
});
