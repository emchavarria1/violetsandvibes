const STRIPE_API_BASE = "https://api.stripe.com/v1";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_IDENTITY_WEBHOOK_SECRET = Deno.env.get("STRIPE_IDENTITY_WEBHOOK_SECRET") ?? "";
const APP_SITE_URL = Deno.env.get("APP_SITE_URL") ?? "";

type VerificationStatus = "pending" | "submitted" | "approved" | "rejected";
type StripeSessionStatus = "requires_input" | "processing" | "verified" | "canceled";

type StripeSessionError = {
  code?: string | null;
  reason?: string | null;
};

export type StripeVerificationSession = {
  id: string;
  status: StripeSessionStatus;
  url?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
  last_error?: StripeSessionError | null;
  last_verification_report?: string | null;
};

const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStatus(value: unknown, fallback: VerificationStatus): VerificationStatus {
  if (typeof value !== "string") return fallback;
  const lowered = value.trim().toLowerCase();
  if (lowered === "pending" || lowered === "submitted" || lowered === "approved" || lowered === "rejected") {
    return lowered;
  }
  return fallback;
}

function normalizeStripeStatus(value: unknown): StripeSessionStatus | null {
  if (typeof value !== "string") return null;
  const lowered = value.trim().toLowerCase();
  if (
    lowered === "requires_input" ||
    lowered === "processing" ||
    lowered === "verified" ||
    lowered === "canceled"
  ) {
    return lowered;
  }
  return null;
}

function asRecordOfStrings(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => typeof entry === "string")
    .map(([key, entry]) => [key, String(entry)]);

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export function parseStripeVerificationSession(value: unknown): StripeVerificationSession | null {
  const record = asObject(value);
  const id = asString(record.id);
  const status = normalizeStripeStatus(record.status);

  if (!id || !status) return null;

  const error = asObject(record.last_error);

  return {
    id,
    status,
    url: asString(record.url),
    client_reference_id: asString(record.client_reference_id),
    metadata: asRecordOfStrings(record.metadata),
    last_error:
      Object.keys(error).length > 0
        ? {
            code: asString(error.code),
            reason: asString(error.reason),
          }
        : null,
    last_verification_report: asString(record.last_verification_report),
  };
}

export function requireStripeSecretKey() {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is missing in Edge Function runtime.");
  }
  return STRIPE_SECRET_KEY;
}

export function requireStripeWebhookSecret() {
  if (!STRIPE_IDENTITY_WEBHOOK_SECRET) {
    throw new Error("STRIPE_IDENTITY_WEBHOOK_SECRET is missing in Edge Function runtime.");
  }
  return STRIPE_IDENTITY_WEBHOOK_SECRET;
}

export function resolveStripeReturnUrl(path = "/verification?stripe_identity=return") {
  const base = APP_SITE_URL || "https://www.violetsandvibes.com";
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function sanitizeStripeReturnUrl(value?: string | null) {
  const fallback = resolveStripeReturnUrl();
  const candidate = asString(value);
  if (!candidate) return fallback;

  try {
    const parsed = new URL(candidate);
    const appOrigin = APP_SITE_URL ? new URL(APP_SITE_URL).origin : null;
    const isAllowedOrigin = appOrigin ? parsed.origin === appOrigin : false;
    const isAllowedLocal =
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      LOCALHOST_HOSTS.has(parsed.hostname);

    if (!isAllowedOrigin && !isAllowedLocal) {
      return fallback;
    }

    return parsed.toString();
  } catch {
    return fallback;
  }
}

async function stripeRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    form?: URLSearchParams;
  } = {}
): Promise<T> {
  const secretKey = requireStripeSecretKey();
  const method = options.method ?? "POST";
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? options.form?.toString() ?? "" : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorObj = asObject(asObject(payload).error);
    const message =
      asString(errorObj.message) ?? asString(asObject(payload).message) ?? "Stripe request failed.";
    throw new Error(message);
  }

  return payload as T;
}

export async function createStripeVerificationSession(params: {
  userId: string;
  fullName?: string | null;
  returnUrl?: string;
}) {
  const form = new URLSearchParams();
  form.set("type", "document");
  form.set("return_url", params.returnUrl ?? resolveStripeReturnUrl());
  form.set("client_reference_id", params.userId);
  form.set("metadata[supabase_user_id]", params.userId);
  form.set("options[document][require_matching_selfie]", "true");

  const fullName = asString(params.fullName);
  if (fullName) {
    form.set("provided_details[first_name]", fullName.split(/\s+/)[0] ?? fullName);
    const lastName = fullName.split(/\s+/).slice(1).join(" ").trim();
    if (lastName) {
      form.set("provided_details[last_name]", lastName);
    }
  }

  const payload = await stripeRequest<unknown>("/identity/verification_sessions", {
    method: "POST",
    form,
  });

  const session = parseStripeVerificationSession(payload);
  if (!session) {
    throw new Error("Stripe returned an invalid verification session payload.");
  }

  return session;
}

export async function retrieveStripeVerificationSession(sessionId: string) {
  const payload = await stripeRequest<unknown>(
    `/identity/verification_sessions/${encodeURIComponent(sessionId)}`,
    { method: "GET" }
  );

  const session = parseStripeVerificationSession(payload);
  if (!session) {
    throw new Error("Stripe returned an invalid verification session payload.");
  }

  return session;
}

export function updateSafetyWithStripeStart(
  existingSafety: Record<string, unknown>,
  session: StripeVerificationSession,
  now: string
) {
  return {
    ...existingSafety,
    verification_audit: {
      ...asObject(existingSafety.verification_audit),
      source: "stripe_identity",
      provider: "stripe_identity",
      reviewerType: "provider",
      decision: "started",
      reviewedBy: null,
      reviewedAt: null,
      startedAt: now,
      updatedAt: now,
    },
    stripe_identity: {
      provider: "stripe_identity",
      sessionId: session.id,
      status: session.status,
      hostedUrl: session.url ?? null,
      lastVerificationReport: session.last_verification_report ?? null,
      lastErrorCode: asString(session.last_error?.code),
      lastErrorReason: asString(session.last_error?.reason),
      startedAt: now,
      updatedAt: now,
    },
  };
}

export function updateSafetyFromStripeSession(
  existingSafety: Record<string, unknown>,
  session: StripeVerificationSession,
  now: string
) {
  const nextSafety: Record<string, unknown> = { ...existingSafety };
  const stripeState = asObject(existingSafety.stripe_identity);
  const auditState = asObject(existingSafety.verification_audit);
  const errorCode = asString(session.last_error?.code);
  const errorReason = asString(session.last_error?.reason);
  const currentPhotoStatus = normalizeStatus(existingSafety.verification_photo_status, "pending");
  const currentIdStatus = normalizeStatus(existingSafety.verification_id_status, "pending");

  nextSafety.stripe_identity = {
    ...stripeState,
    provider: "stripe_identity",
    sessionId: session.id,
    status: session.status,
    hostedUrl: session.url ?? asString(stripeState.hostedUrl),
    lastVerificationReport: session.last_verification_report ?? asString(stripeState.lastVerificationReport),
    lastErrorCode: errorCode,
    lastErrorReason: errorReason,
    updatedAt: now,
    verifiedAt: session.status === "verified" ? now : asString(stripeState.verifiedAt),
  };
  nextSafety.verification_audit = {
    ...auditState,
    source: "stripe_identity",
    provider: "stripe_identity",
    reviewerType: "provider",
    reviewedBy: null,
    updatedAt: now,
    reviewedAt: session.status === "verified" ? now : asString(auditState.reviewedAt),
    decision: session.status,
  };

  if (session.status === "verified") {
    nextSafety.verification_photo_status = "approved";
    nextSafety.verification_id_status = "approved";
    nextSafety.verification_under_review = false;
    nextSafety.photoVerification = true;
    nextSafety.verification_submitted_at = asString(existingSafety.verification_submitted_at) ?? now;
    nextSafety.verification_rejection_reason = null;
    nextSafety.verification_auto_review = {};
    nextSafety.verification_audit = {
      ...asObject(nextSafety.verification_audit),
      decision: "approved",
      reviewedAt: now,
      approvedAt: now,
      rejectedAt: null,
    };
    return nextSafety;
  }

  if (session.status === "processing") {
    nextSafety.verification_photo_status = currentPhotoStatus === "approved" ? "approved" : "submitted";
    nextSafety.verification_id_status = currentIdStatus === "approved" ? "approved" : "submitted";
    nextSafety.verification_under_review = true;
    nextSafety.photoVerification = false;
    nextSafety.verification_submitted_at = asString(existingSafety.verification_submitted_at) ?? now;
    nextSafety.verification_rejection_reason = null;
    nextSafety.verification_audit = {
      ...asObject(nextSafety.verification_audit),
      decision: "processing",
    };
    return nextSafety;
  }

  if (session.status === "requires_input") {
    if (errorCode || errorReason) {
      nextSafety.verification_photo_status = currentPhotoStatus === "approved" ? "approved" : "rejected";
      nextSafety.verification_id_status = currentIdStatus === "approved" ? "approved" : "rejected";
      nextSafety.verification_under_review = false;
      nextSafety.photoVerification = false;
      nextSafety.verification_rejection_reason = errorReason ?? errorCode ?? "Verification needs another attempt.";
      nextSafety.verification_audit = {
        ...asObject(nextSafety.verification_audit),
        decision: "rejected",
        reviewedAt: now,
        rejectedAt: now,
      };
    }
    return nextSafety;
  }

  if (session.status === "canceled") {
    nextSafety.verification_photo_status = currentPhotoStatus === "approved" ? "approved" : "rejected";
    nextSafety.verification_id_status = currentIdStatus === "approved" ? "approved" : "rejected";
    nextSafety.verification_under_review = false;
    nextSafety.photoVerification = false;
    nextSafety.verification_rejection_reason = "Verification was canceled before it completed.";
    nextSafety.verification_audit = {
      ...asObject(nextSafety.verification_audit),
      decision: "canceled",
      reviewedAt: now,
      rejectedAt: now,
    };
  }

  return nextSafety;
}

function secureCompare(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyStripeWebhookSignature(payload: string, header: string | null) {
  const secret = requireStripeWebhookSecret();
  if (!header) return false;

  const parts = header.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2) ?? null;
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3))
    .filter(Boolean);

  if (!timestamp || signatures.length === 0) return false;

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(currentTimestamp - sentAt) > 300) {
    return false;
  }

  const expected = await hmacSha256Hex(secret, `${timestamp}.${payload}`);
  return signatures.some((candidate) => secureCompare(candidate, expected));
}
