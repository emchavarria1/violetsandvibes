import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createServiceClient, requireUser } from "../_shared/supabase.ts";

type UploadType = "photo" | "id";
type VerificationStatus = "pending" | "submitted" | "approved" | "rejected";
type AutoReviewStatus = "pending" | "approved" | "needs_review" | "rejected";

type FileMeta = {
  mimeType: string | null;
  sizeBytes: number | null;
  extension: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
};

type AutoItemReview = {
  status: VerificationStatus;
  score: number;
  summary: string;
  flags: string[];
};

type ProfileAssessment = {
  approvalFlags: string[];
  advisoryFlags: string[];
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeStatus(value: unknown, fallback: VerificationStatus): VerificationStatus {
  if (typeof value !== "string") return fallback;
  const lowered = value.trim().toLowerCase();
  if (lowered === "pending" || lowered === "submitted" || lowered === "approved" || lowered === "rejected") {
    return lowered;
  }
  return fallback;
}

function normalizeUploadType(value: unknown): UploadType | null {
  if (typeof value !== "string") return null;
  const lowered = value.trim().toLowerCase();
  if (lowered === "photo" || lowered === "id") return lowered;
  return null;
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildComputedState(safetySettings: Record<string, unknown>) {
  const photoStatus = normalizeStatus(
    safetySettings.verification_photo_status ?? safetySettings.photo_status,
    "pending"
  );
  const idStatus = normalizeStatus(
    safetySettings.verification_id_status ?? safetySettings.id_status,
    "pending"
  );

  const fullyApproved = photoStatus === "approved" && idStatus === "approved";
  const submittedForReview =
    (photoStatus === "submitted" || photoStatus === "approved") &&
    (idStatus === "submitted" || idStatus === "approved");
  const underReview = !fullyApproved && submittedForReview && photoStatus !== "rejected" && idStatus !== "rejected";
  const completeForAccess = fullyApproved;

  return {
    photoStatus,
    idStatus,
    fullyApproved,
    submittedForReview,
    underReview,
    completeForAccess,
  };
}

function parseBirthdateAge(value: unknown): number | null {
  const birthdate = asString(value);
  if (!birthdate) return null;

  const date = new Date(birthdate);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - date.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < date.getUTCDate())) {
    age -= 1;
  }
  return age;
}

function assessProfile(profile: Record<string, unknown>): ProfileAssessment {
  const approvalFlags: string[] = [];
  const advisoryFlags: string[] = [];

  const fullName = asString(profile.full_name);
  if (!fullName || fullName.length < 4) {
    approvalFlags.push("Profile needs a full name before automatic verification can finish.");
  }

  const age = parseBirthdateAge(profile.birthdate);
  if (age === null) {
    approvalFlags.push("Profile birthdate is missing or invalid.");
  } else if (age < 18) {
    approvalFlags.push("Birthdate shows this account is under 18.");
  } else if (age > 100) {
    advisoryFlags.push("Birthdate looks unusual and should be double-checked.");
  }

  if (profile.profile_completed !== true) {
    approvalFlags.push("Profile should be completed before automatic verification can finish.");
  }

  const bio = asString(profile.bio);
  if (!bio || bio.length < 20) {
    advisoryFlags.push("Short bios still tend to need a quick human double-check.");
  }

  return { approvalFlags, advisoryFlags };
}

function parseFileMeta(value: unknown): FileMeta {
  const input = asObject(value);
  return {
    mimeType: asString(input.mimeType),
    sizeBytes: asNumber(input.sizeBytes),
    extension: asString(input.extension),
    imageWidth: asNumber(input.imageWidth),
    imageHeight: asNumber(input.imageHeight),
  };
}

function getStoredFileMeta(safety: Record<string, unknown>, type: UploadType): FileMeta {
  return parseFileMeta(safety[`verification_${type}_file_meta`]);
}

function isMissingFileMeta(meta: FileMeta) {
  return (
    meta.mimeType == null &&
    meta.sizeBytes == null &&
    meta.extension == null &&
    meta.imageWidth == null &&
    meta.imageHeight == null
  );
}

function isManualDecisionLocked(
  safety: Record<string, unknown>,
  type: UploadType,
  currentUploadType: UploadType
) {
  if (type === currentUploadType) return false;
  const status = normalizeStatus(safety[`verification_${type}_status`], "pending");
  const reviewedAt = asString(safety[`verification_${type}_reviewed_at`]);
  return !!reviewedAt && (status === "approved" || status === "rejected");
}

function preservedReview(safety: Record<string, unknown>, type: UploadType): AutoItemReview {
  const autoReview = asObject(safety.verification_auto_review);
  const item = asObject(autoReview[type]);
  const status = normalizeStatus(safety[`verification_${type}_status`], "pending");
  const summary = asString(item.summary) ??
    (status === "approved"
      ? `${type === "photo" ? "Photo" : "ID"} decision was already finalized.`
      : status === "rejected"
      ? `${type === "photo" ? "Photo" : "ID"} needs a fresh upload before it can be reviewed again.`
      : `${type === "photo" ? "Photo" : "ID"} is waiting for review.`);
  return {
    status,
    score: typeof item.score === "number" && Number.isFinite(item.score) ? clampScore(item.score) : 100,
    summary,
    flags: asStringArray(item.flags),
  };
}

function evaluatePhoto(meta: FileMeta): AutoItemReview {
  const flags: string[] = [];
  let score = 0;

  if (isMissingFileMeta(meta)) {
    return {
      status: "pending",
      score: 0,
      summary: "Upload your verification photo to start the automatic checks.",
      flags: [],
    };
  }

  if (!meta.mimeType || !meta.mimeType.startsWith("image/")) {
    return {
      status: "rejected",
      score: 0,
      summary: "Verification photos must be image files.",
      flags: ["Upload a JPG, PNG, or HEIC photo."],
    };
  }
  score += 25;

  if (!meta.sizeBytes || meta.sizeBytes <= 0) {
    flags.push("Photo file size could not be read.");
  } else if (meta.sizeBytes < 25_000) {
    return {
      status: "rejected",
      score: 10,
      summary: "The uploaded photo looks too small or compressed to trust.",
      flags: ["Retake the photo with better lighting and keep your face centered."],
    };
  } else if (meta.sizeBytes < 60_000) {
    flags.push("Photo file is unusually small, so it should be double-checked.");
    score += 10;
  } else if (meta.sizeBytes > MAX_FILE_BYTES) {
    return {
      status: "rejected",
      score: 0,
      summary: "The uploaded photo is larger than the allowed limit.",
      flags: ["Use a photo under 10MB."],
    };
  } else {
    score += 20;
  }

  if (meta.imageWidth == null || meta.imageHeight == null) {
    flags.push("Photo dimensions could not be read automatically.");
  } else if (meta.imageWidth < 320 || meta.imageHeight < 320) {
    return {
      status: "rejected",
      score: 15,
      summary: "The uploaded photo is too low-resolution to trust.",
      flags: ["Retake the photo so your face fills more of the frame."],
    };
  } else if (meta.imageWidth < 640 || meta.imageHeight < 640) {
    flags.push("Photo resolution is low, so it should be checked by a person.");
    score += 10;
  } else {
    score += 25;
  }

  if (meta.imageWidth && meta.imageHeight) {
    const aspectRatio = meta.imageWidth / meta.imageHeight;
    if (aspectRatio < 0.55 || aspectRatio > 1.9) {
      flags.push("Photo framing looks unusual and should be double-checked.");
    } else {
      score += 10;
    }
  }

  if (flags.length > 0) {
    return {
      status: "submitted",
      score: clampScore(score),
      summary: "Photo passed the basic checks but still needs a final review.",
      flags,
    };
  }

  return {
    status: "approved",
    score: clampScore(score + 10),
    summary: "Photo passed the automatic quality checks.",
    flags: [],
  };
}

function evaluateId(meta: FileMeta, profile: ProfileAssessment): AutoItemReview {
  const flags = [...profile.approvalFlags, ...profile.advisoryFlags];
  let score = 0;

  if (isMissingFileMeta(meta)) {
    return {
      status: "pending",
      score: 0,
      summary: "Upload your ID to start the automatic checks.",
      flags: [],
    };
  }

  if (!meta.mimeType) {
    return {
      status: "rejected",
      score: 0,
      summary: "The uploaded ID could not be read.",
      flags: ["Upload a clearer ID image or PDF."],
    };
  }

  if (!meta.mimeType.startsWith("image/") && meta.mimeType !== "application/pdf") {
    return {
      status: "rejected",
      score: 0,
      summary: "ID uploads must be an image or a PDF.",
      flags: ["Upload a photo or scan of your ID."],
    };
  }
  score += 20;

  if (!meta.sizeBytes || meta.sizeBytes <= 0) {
    flags.push("ID file size could not be read.");
  } else if (meta.sizeBytes < 35_000) {
    return {
      status: "rejected",
      score: 10,
      summary: "The uploaded ID file looks too small or incomplete to trust.",
      flags: ["Upload a clearer photo or scan of the document."],
    };
  } else if (meta.sizeBytes < 90_000) {
    flags.push("ID file is unusually small, so it should be double-checked.");
    score += 10;
  } else if (meta.sizeBytes > MAX_FILE_BYTES) {
    return {
      status: "rejected",
      score: 0,
      summary: "The uploaded ID is larger than the allowed limit.",
      flags: ["Use a file under 10MB."],
    };
  } else {
    score += 20;
  }

  if (meta.mimeType === "application/pdf") {
    flags.push("PDF IDs still need a final human review.");
    score += 15;
  } else {
    if (meta.imageWidth == null || meta.imageHeight == null) {
      flags.push("ID image dimensions could not be read automatically.");
    } else if (meta.imageWidth < 600 || meta.imageHeight < 400) {
      return {
        status: "rejected",
        score: 20,
        summary: "The uploaded ID image is too low-resolution to trust.",
        flags: ["Retake the ID photo so the document fills more of the frame."],
      };
    } else if (meta.imageWidth < 1000 || meta.imageHeight < 650) {
      flags.push("ID image resolution is low, so it should be checked by a person.");
      score += 10;
    } else {
      score += 25;
    }

    if (meta.imageWidth && meta.imageHeight) {
      const aspectRatio = meta.imageWidth / meta.imageHeight;
      if (aspectRatio < 1.1 || aspectRatio > 2.4) {
        flags.push("ID framing looks unusual and should be double-checked.");
      } else {
        score += 10;
      }
    }
  }

  if (flags.length > 0) {
    return {
      status: "submitted",
      score: clampScore(score),
      summary: "ID passed the basic checks but still needs a final review.",
      flags,
    };
  }

  return {
    status: "approved",
    score: clampScore(score + 15),
    summary: "ID passed the automatic quality and profile checks.",
    flags: [],
  };
}

function computeOverallStatus(photo: AutoItemReview, id: AutoItemReview): AutoReviewStatus {
  if (photo.status === "rejected" || id.status === "rejected") return "rejected";
  if (photo.status === "approved" && id.status === "approved") return "approved";
  if (photo.status === "submitted" || id.status === "submitted") return "needs_review";
  return "pending";
}

function buildOverallSummary(status: AutoReviewStatus, flags: string[]) {
  if (status === "approved") {
    return "Your uploads passed the automatic checks and verification is complete.";
  }
  if (status === "rejected") {
    return "At least one upload needs a clearer replacement before verification can continue.";
  }
  if (status === "needs_review") {
    return flags.length > 0
      ? "Automatic checks found a few items that should still be reviewed by a person."
      : "Automatic checks finished and a final review is still needed.";
  }
  return "Upload both your verification photo and ID to continue.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const { user, errorResponse } = await requireUser(req);
  if (errorResponse || !user) return errorResponse!;

  try {
    const body = await req.json().catch(() => ({}));
    const uploadType = normalizeUploadType(body?.type);
    if (!uploadType) {
      return jsonResponse({ error: "type must be photo or id." }, 400);
    }

    const fileName = asString(body?.fileName);
    const storagePath = asString(body?.storagePath);
    const fileMeta = parseFileMeta(body?.fileMeta);
    const now = new Date().toISOString();

    if (!fileName || !storagePath) {
      return jsonResponse({ error: "fileName and storagePath are required." }, 400);
    }

    const service = createServiceClient();
    const { data: profileRow, error: profileError } = await service
      .from("profiles")
      .select("id, full_name, username, birthdate, bio, photos, profile_completed, safety_settings")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profileRow) {
      return jsonResponse({ error: "Profile not found. Complete your profile first." }, 404);
    }

    const profile = asObject(profileRow);
    const safety = asObject(profileRow.safety_settings);
    const nextSafety: Record<string, unknown> = { ...safety };

    nextSafety[`verification_${uploadType}_file_name`] = fileName;
    nextSafety[`verification_${uploadType}_storage_path`] = storagePath;
    nextSafety[`verification_${uploadType}_updated_at`] = now;
    nextSafety[`verification_${uploadType}_file_meta`] = {
      mimeType: fileMeta.mimeType,
      sizeBytes: fileMeta.sizeBytes,
      extension: fileMeta.extension,
      imageWidth: fileMeta.imageWidth,
      imageHeight: fileMeta.imageHeight,
      analyzedAt: now,
    };

    nextSafety.verification_reviewed_at = null;
    nextSafety.verification_reviewed_by = null;
    nextSafety[`verification_${uploadType}_reviewed_at`] = null;

    const profileAssessment = assessProfile(profile);

    const photoReview = isManualDecisionLocked(safety, "photo", uploadType)
      ? preservedReview(safety, "photo")
      : evaluatePhoto(getStoredFileMeta(nextSafety, "photo"));
    const idReview = isManualDecisionLocked(safety, "id", uploadType)
      ? preservedReview(safety, "id")
      : evaluateId(getStoredFileMeta(nextSafety, "id"), profileAssessment);

    nextSafety.verification_photo_status = photoReview.status;
    nextSafety.verification_id_status = idReview.status;

    const overallFlags = Array.from(new Set([...photoReview.flags, ...idReview.flags]));
    const overallStatus = computeOverallStatus(photoReview, idReview);
    const overallScore = clampScore((photoReview.score + idReview.score) / 2);

    nextSafety.verification_auto_review = {
      overallStatus,
      overallScore,
      summary: buildOverallSummary(overallStatus, overallFlags),
      flags: overallFlags,
      reviewedAt: now,
      photo: photoReview,
      id: idReview,
      lastUploadType: uploadType,
    };

    const computed = buildComputedState(nextSafety);
    nextSafety.verification_under_review = computed.underReview;
    nextSafety.photoVerification = computed.fullyApproved;
    nextSafety.verification_submitted_at =
      computed.submittedForReview || computed.fullyApproved ? now : safety.verification_submitted_at ?? null;
    nextSafety.verification_rejection_reason =
      overallStatus === "rejected"
        ? photoReview.status === "rejected"
          ? photoReview.summary
          : idReview.summary
        : null;

    const { error: updateError } = await service
      .from("profiles")
      .update({
        safety_settings: nextSafety,
        updated_at: now,
      })
      .eq("id", user.id);

    if (updateError) throw updateError;

    return jsonResponse({
      success: true,
      uploadType,
      photoStatus: computed.photoStatus,
      idStatus: computed.idStatus,
      completeForAccess: computed.completeForAccess,
      underReview: computed.underReview,
      safetySettings: nextSafety,
      autoReview: nextSafety.verification_auto_review,
      currentUpload: uploadType === "photo" ? photoReview : idReview,
    });
  } catch (error) {
    console.error("verification-autoreview failed:", error);
    return jsonResponse(
      { error: (error as Error)?.message || "Automatic verification review failed." },
      500
    );
  }
});
