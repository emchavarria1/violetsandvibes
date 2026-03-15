export type VerificationStatus = "pending" | "submitted" | "approved" | "rejected";
export type VerificationAutoReviewStatus = "pending" | "approved" | "needs_review" | "rejected";

export type VerificationState = {
  photoStatus: VerificationStatus;
  idStatus: VerificationStatus;
  fullyApproved: boolean;
  submittedForReview: boolean;
  completeForAccess: boolean;
  underReview: boolean;
};

export type VerificationAutomationItemState = {
  status: VerificationStatus;
  score: number | null;
  summary: string | null;
  flags: string[];
};

export type VerificationAutomationState = {
  overallStatus: VerificationAutoReviewStatus;
  overallScore: number | null;
  summary: string | null;
  flags: string[];
  reviewedAt: string | null;
  photo: VerificationAutomationItemState;
  id: VerificationAutomationItemState;
};

export type StripeIdentityStatus =
  | "not_started"
  | "requires_input"
  | "processing"
  | "verified"
  | "canceled"
  | "unknown";

export type StripeIdentityState = {
  provider: string | null;
  sessionId: string | null;
  status: StripeIdentityStatus;
  hostedUrl: string | null;
  lastVerificationReport: string | null;
  lastErrorCode: string | null;
  lastErrorReason: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  verifiedAt: string | null;
};

const VALID_STATUS: VerificationStatus[] = ["pending", "submitted", "approved", "rejected"];
const VALID_AUTO_STATUS: VerificationAutoReviewStatus[] = [
  "pending",
  "approved",
  "needs_review",
  "rejected",
];
const VALID_STRIPE_STATUS: StripeIdentityStatus[] = [
  "not_started",
  "requires_input",
  "processing",
  "verified",
  "canceled",
  "unknown",
];

function normalizeStatus(value: unknown, fallback: VerificationStatus): VerificationStatus {
  if (typeof value !== "string") return fallback;
  const lowered = value.trim().toLowerCase();
  if (VALID_STATUS.includes(lowered as VerificationStatus)) {
    return lowered as VerificationStatus;
  }
  return fallback;
}

function normalizeAutoStatus(
  value: unknown,
  fallback: VerificationAutoReviewStatus
): VerificationAutoReviewStatus {
  if (typeof value !== "string") return fallback;
  const lowered = value.trim().toLowerCase();
  if (VALID_AUTO_STATUS.includes(lowered as VerificationAutoReviewStatus)) {
    return lowered as VerificationAutoReviewStatus;
  }
  return fallback;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function normalizeScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeFlags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSummary(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStripeStatus(value: unknown): StripeIdentityStatus {
  if (typeof value !== "string") return "not_started";
  const lowered = value.trim().toLowerCase();
  if (VALID_STRIPE_STATUS.includes(lowered as StripeIdentityStatus)) {
    return lowered as StripeIdentityStatus;
  }
  return "unknown";
}

function buildAutomationItemState(value: unknown): VerificationAutomationItemState {
  const item = asObject(value);
  return {
    status: normalizeStatus(item.status, "pending"),
    score: normalizeScore(item.score),
    summary: normalizeSummary(item.summary),
    flags: normalizeFlags(item.flags),
  };
}

export function getVerificationState(safetySettings: unknown): VerificationState {
  const safety =
    safetySettings && typeof safetySettings === "object"
      ? (safetySettings as Record<string, unknown>)
      : {};

  if (safety.photoVerification === true) {
    return {
      photoStatus: "approved",
      idStatus: "approved",
      fullyApproved: true,
      submittedForReview: true,
      completeForAccess: true,
      underReview: false,
    };
  }

  const photoStatus = normalizeStatus(
    safety.verification_photo_status ?? safety.photo_status,
    "pending"
  );
  const idStatus = normalizeStatus(
    safety.verification_id_status ?? safety.id_status,
    "pending"
  );

  const statusSet = new Set<VerificationStatus>([photoStatus, idStatus]);
  const fullyApproved = photoStatus === "approved" && idStatus === "approved";
  const submittedForReview =
    (photoStatus === "submitted" || photoStatus === "approved") &&
    (idStatus === "submitted" || idStatus === "approved");
  const completeForAccess = fullyApproved;
  const underReview =
    !fullyApproved &&
    submittedForReview &&
    !statusSet.has("pending") &&
    !statusSet.has("rejected");

  return {
    photoStatus,
    idStatus,
    fullyApproved,
    submittedForReview,
    completeForAccess,
    underReview,
  };
}

export function getVerificationAutomationState(
  safetySettings: unknown
): VerificationAutomationState {
  const safety = asObject(safetySettings);
  const review = asObject(safety.verification_auto_review);

  return {
    overallStatus: normalizeAutoStatus(review.overallStatus, "pending"),
    overallScore: normalizeScore(review.overallScore),
    summary: normalizeSummary(review.summary),
    flags: normalizeFlags(review.flags),
    reviewedAt: normalizeSummary(review.reviewedAt),
    photo: buildAutomationItemState(review.photo),
    id: buildAutomationItemState(review.id),
  };
}

export function getStripeIdentityState(safetySettings: unknown): StripeIdentityState {
  const safety = asObject(safetySettings);
  const stripe = asObject(safety.stripe_identity);
  const sessionId = normalizeSummary(stripe.sessionId);

  return {
    provider: normalizeSummary(stripe.provider),
    sessionId,
    status: sessionId ? normalizeStripeStatus(stripe.status) : "not_started",
    hostedUrl: normalizeSummary(stripe.hostedUrl),
    lastVerificationReport: normalizeSummary(stripe.lastVerificationReport),
    lastErrorCode: normalizeSummary(stripe.lastErrorCode),
    lastErrorReason: normalizeSummary(stripe.lastErrorReason),
    startedAt: normalizeSummary(stripe.startedAt),
    updatedAt: normalizeSummary(stripe.updatedAt),
    verifiedAt: normalizeSummary(stripe.verifiedAt),
  };
}
