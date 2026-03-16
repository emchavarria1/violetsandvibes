import { supabase } from "@/lib/supabase";

export const PROFILE_VIBE_OPTIONS = [
  {
    value: "curious",
    label: "Curious",
    description: "I want to know more about you.",
    buttonClass:
      "border-cyan-300/35 bg-cyan-500/12 text-cyan-50 hover:bg-cyan-500/20 hover:border-cyan-200/45",
  },
  {
    value: "friendly",
    label: "Friendly",
    description: "You feel warm and easy to talk to.",
    buttonClass:
      "border-emerald-300/35 bg-emerald-500/12 text-emerald-50 hover:bg-emerald-500/20 hover:border-emerald-200/45",
  },
  {
    value: "flirty",
    label: "Flirty",
    description: "There is definite chemistry here.",
    buttonClass:
      "border-pink-300/35 bg-pink-500/12 text-pink-50 hover:bg-pink-500/20 hover:border-pink-200/45",
  },
  {
    value: "intrigued",
    label: "Intrigued",
    description: "You caught my attention in a real way.",
    buttonClass:
      "border-violet-300/35 bg-violet-500/12 text-violet-50 hover:bg-violet-500/20 hover:border-violet-200/45",
  },
] as const;

export type ProfileVibe = (typeof PROFILE_VIBE_OPTIONS)[number]["value"];

export function isProfileVibe(value: unknown): value is ProfileVibe {
  return PROFILE_VIBE_OPTIONS.some((option) => option.value === value);
}

export function getProfileVibeLabel(vibe?: string | null) {
  if (!vibe) return null;
  return PROFILE_VIBE_OPTIONS.find((option) => option.value === vibe)?.label ?? vibe;
}

export async function sendProfileVibe(
  senderId: string,
  recipientId: string,
  vibe: ProfileVibe
) {
  if (!senderId || !recipientId) {
    throw new Error("Both users are required to send a vibe.");
  }

  const { error: likeError } = await supabase
    .from("likes")
    .upsert(
      {
        liker_id: senderId,
        liked_id: recipientId,
        vibe,
      },
      {
        onConflict: "liker_id,liked_id",
      }
    );

  if (likeError) {
    throw likeError;
  }

  const a = senderId < recipientId ? senderId : recipientId;
  const b = senderId < recipientId ? recipientId : senderId;

  const { data: matchRow, error: matchLookupError } = await supabase
    .from("matches")
    .select("id, conversation_id")
    .eq("user1_id", a)
    .eq("user2_id", b)
    .maybeSingle();

  if (matchLookupError) {
    throw matchLookupError;
  }

  return {
    matched: !!matchRow,
    conversationId: matchRow?.conversation_id ?? null,
  };
}
