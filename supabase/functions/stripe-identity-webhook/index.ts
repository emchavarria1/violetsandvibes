import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import {
  parseStripeVerificationSession,
  updateSafetyFromStripeSession,
  verifyStripeWebhookSignature,
} from "../_shared/stripeIdentity.ts";

const HANDLED_EVENT_TYPES = new Set([
  "identity.verification_session.created",
  "identity.verification_session.processing",
  "identity.verification_session.requires_input",
  "identity.verification_session.verified",
  "identity.verification_session.canceled",
]);

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const payload = await req.text();
    const signature = req.headers.get("Stripe-Signature") || req.headers.get("stripe-signature");
    const valid = await verifyStripeWebhookSignature(payload, signature);

    if (!valid) {
      return jsonResponse({ error: "Invalid Stripe webhook signature." }, 400);
    }

    const event = JSON.parse(payload);
    const eventType = asString(asObject(event).type);
    if (!eventType || !HANDLED_EVENT_TYPES.has(eventType)) {
      return jsonResponse({ received: true, ignored: true });
    }

    const session = parseStripeVerificationSession(asObject(asObject(asObject(event).data).object));
    if (!session) {
      return jsonResponse({ received: true, ignored: true, reason: "missing_session" });
    }

    const metadataUserId = session.metadata?.supabase_user_id ?? null;
    const userId = asString(metadataUserId) ?? asString(session.client_reference_id);
    if (!userId) {
      return jsonResponse({ received: true, ignored: true, reason: "missing_user_id" });
    }

    const service = createServiceClient();
    const { data: profile, error } = await service
      .from("profiles")
      .select("id, safety_settings")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!profile) {
      return jsonResponse({ received: true, ignored: true, reason: "profile_not_found" });
    }

    const nextSafety = updateSafetyFromStripeSession(
      asObject(profile.safety_settings),
      session,
      new Date().toISOString()
    );

    const { error: updateError } = await service
      .from("profiles")
      .update({
        safety_settings: nextSafety,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) throw updateError;

    return jsonResponse({
      received: true,
      handled: true,
      eventType,
      userId,
      status: session.status,
    });
  } catch (error) {
    console.error("stripe-identity-webhook failed:", error);
    return jsonResponse(
      { error: (error as Error)?.message || "Stripe webhook processing failed." },
      500
    );
  }
});
