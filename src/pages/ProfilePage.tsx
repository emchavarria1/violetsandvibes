import React, { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Ban, Edit, MapPin, Camera, Star, Loader2, UserPlus, Mic, Square, PlayCircle, Sparkles, Volume2, Trash2 } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import ProfileMenu from "@/components/ProfileMenu";
import MessageButton from "@/components/MessageButton";
import ProfileSafetyScore from "@/components/ProfileSafetyScore";
import KindnessEndorsements from "@/components/KindnessEndorsements";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

function calcAge(birthdate?: string | null) {
  if (!birthdate) return null;
  const d = new Date(birthdate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function getInitials(name: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "V";
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

type EditableProfileForm = {
  full_name: string;
  location: string;
  bio: string;
  gender_identity: string;
  sexual_orientation: string;
  interestsText: string;
  primaryPhoto: string;
  voiceIntroScript: string;
};

const EMPTY_FORM: EditableProfileForm = {
  full_name: "",
  location: "",
  bio: "",
  gender_identity: "",
  sexual_orientation: "",
  interestsText: "",
  primaryPhoto: "",
  voiceIntroScript: "",
};

const MAX_VOICE_INTRO_SECONDS = 15;

function getVoiceIntroStorageKey(profileId?: string) {
  return profileId ? `vv_voice_intro_audio_${profileId}` : "";
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => `${item ?? ""}`.trim()).filter(Boolean);
}

function toTrustCount(privacySettings?: Record<string, any> | null) {
  if (!privacySettings || typeof privacySettings !== "object") return 0;
  if (
    typeof privacySettings.trusted_endorsements_count === "number" &&
    Number.isFinite(privacySettings.trusted_endorsements_count)
  ) {
    return privacySettings.trusted_endorsements_count;
  }
  if (Array.isArray(privacySettings.trusted_endorsements)) {
    return privacySettings.trusted_endorsements.length;
  }
  return 0;
}

function formFromProfile(profile: any): EditableProfileForm {
  const interests = toStringArray(profile?.interests);
  const photos = toStringArray(profile?.photos);

  return {
    full_name: profile?.full_name ?? "",
    location: profile?.location ?? "",
    bio: profile?.bio ?? "",
    gender_identity: profile?.gender_identity ?? "",
    sexual_orientation: profile?.sexual_orientation ?? "",
    interestsText: interests.join(", "),
    primaryPhoto: photos[0] ?? "",
    voiceIntroScript: profile?.lifestyle?.voice_intro_script ?? "",
  };
}

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * Convention:
   * - /profile -> show my profile
   * - /profile/:id -> show that user
   */
  const targetId = id || user?.id || undefined;

  // Keep hook order stable on every render.
  const { profile, loading, error, updateProfile } = useProfile(targetId);
  const [editing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formData, setFormData] = useState<EditableProfileForm>(EMPTY_FORM);

  const isOwnProfile = !!user && !!profile && profile.id === user.id;
  const [liked, setLiked] = useState(false);
  const [matched, setMatched] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [likeError, setLikeError] = useState<string | null>(null);
  const [matchConversationId, setMatchConversationId] = useState<string | null>(null);
  const [blockLoading, setBlockLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [livePrivacySettings, setLivePrivacySettings] = useState<Record<string, any> | null>(null);
  const [voiceIntroAudio, setVoiceIntroAudio] = useState<string>("");
  const [voiceIntroSeconds, setVoiceIntroSeconds] = useState<number>(
    Number(profile?.lifestyle?.voice_intro_seconds ?? 0) || 0
  );
  const [isRecordingVoiceIntro, setIsRecordingVoiceIntro] = useState(false);
  const [voiceIntroSupported, setVoiceIntroSupported] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceIntroChunksRef = useRef<Blob[]>([]);
  const voiceIntroTimeoutRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);

  const otherUserId = !isOwnProfile ? (profile?.id as string | undefined) : undefined;

  const displayName = useMemo(() => {
    return (
      profile?.full_name ||
      profile?.name ||
      profile?.username ||
      "Member"
    );
  }, [profile]);

  const age = useMemo(() => calcAge(profile?.birthdate), [profile?.birthdate]);

  const profilePhoto = useMemo(() => {
    const p = profile?.photos?.[0];
    return p || "";
  }, [profile?.photos]);

  const socialProofItems = useMemo(() => {
    const privacy = (livePrivacySettings ?? profile?.privacy ?? profile?.privacy_settings ?? {}) as Record<string, any>;
    const socialCircles = toStringArray(privacy.social_circles);
    const trustCount = toTrustCount(privacy);
    const items: Array<{ label: string; value: string }> = [];

    if (socialCircles.length > 0) {
      items.push({
        label: "Circle Member",
        value: `${socialCircles[0]} Circle`,
      });
    }

    if (trustCount > 0) {
      items.push({
        label: "Trusted Connection",
        value: trustCount >= 5 ? "Community-endorsed" : "Trust growing in community",
      });
    }

    return items;
  }, [livePrivacySettings, profile?.privacy, profile?.privacy_settings]);

  const voiceIntroText = useMemo(() => {
    return (
      formData.voiceIntroScript ||
      profile?.lifestyle?.voice_intro_script ||
      ""
    ).trim();
  }, [formData.voiceIntroScript, profile?.lifestyle?.voice_intro_script]);

  const hasVoiceIntro = Boolean(voiceIntroText || voiceIntroAudio);

  useEffect(() => {
    if (!profile || editing) return;
    setFormData(formFromProfile(profile));
    setVoiceIntroSeconds(Number(profile?.lifestyle?.voice_intro_seconds ?? 0) || 0);
  }, [profile, editing]);

  useEffect(() => {
    setLivePrivacySettings(
      profile?.privacy ?? profile?.privacy_settings ?? null
    );
  }, [profile?.privacy, profile?.privacy_settings]);

  useEffect(() => {
    setVoiceIntroSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined"
    );
  }, []);

  useEffect(() => {
    const storageKey = getVoiceIntroStorageKey(targetId);
    if (!storageKey || typeof window === "undefined") {
      setVoiceIntroAudio("");
      return;
    }

    setVoiceIntroAudio(window.localStorage.getItem(storageKey) || "");
  }, [targetId]);

  useEffect(() => {
    return () => {
      if (voiceIntroTimeoutRef.current) {
        window.clearTimeout(voiceIntroTimeoutRef.current);
      }
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!user || !otherUserId) {
        setLiked(false);
        setMatched(false);
        setMatchConversationId(null);
        return;
      }

      setLikeError(null);

      // 1) Did I already like them?
      const { data: likeRow, error: likeErr } = await supabase
        .from("likes")
        .select("id")
        .eq("liker_id", user.id)
        .eq("liked_id", otherUserId)
        .maybeSingle();

      if (likeErr) {
        console.warn("like lookup failed:", likeErr.message);
      }
      setLiked(!!likeRow);

      // 2) Are we matched?
      // NOTE: this project stores matches as user1_id/user2_id.
      const a = user.id < otherUserId ? user.id : otherUserId;
      const b = user.id < otherUserId ? otherUserId : user.id;

      const { data: matchRow, error: matchErr } = await supabase
        .from("matches")
        .select("id, conversation_id")
        .eq("user1_id", a)
        .eq("user2_id", b)
        .maybeSingle();

      if (matchErr) {
        console.warn("match lookup failed:", matchErr.message);
      }
      setMatched(!!matchRow);
      setMatchConversationId(matchRow?.conversation_id ?? null);
    };

    void run();
  }, [user?.id, otherUserId]);

  useEffect(() => {
    const loadBlockState = async () => {
      if (!user?.id || !otherUserId) {
        setIsBlocked(false);
        return;
      }

      try {
        const { data: ownRow, error: ownErr } = await supabase
          .from("profiles")
          .select("safety_settings")
          .eq("id", user.id)
          .maybeSingle();

        if (ownErr) throw ownErr;

        const safety =
          ownRow?.safety_settings && typeof ownRow.safety_settings === "object"
            ? (ownRow.safety_settings as Record<string, any>)
            : {};

        const blockedIds = toStringArray(safety.blocked_user_ids);
        setIsBlocked(blockedIds.includes(otherUserId));
      } catch (loadError) {
        console.warn("Could not load block state:", loadError);
        setIsBlocked(false);
      }
    };

    void loadBlockState();
  }, [user?.id, otherUserId]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    if (!(name in formData)) return;
    setFormData((prev) => ({ ...prev, [name as keyof EditableProfileForm]: value }));
  };

  const startEditing = () => {
    if (!profile) return;
    setSaveError(null);
    setFormData(formFromProfile(profile));
    setEditing(true);
  };

  const cancelEditing = () => {
    if (profile) {
      setFormData(formFromProfile(profile));
    }
    setSaveError(null);
    setEditing(false);
  };

  const handleSubmit = async () => {
    if (!isOwnProfile || !profile || !user) return;

    const interests = formData.interestsText
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    const existingPhotos = toStringArray(profile.photos);
    const remainingPhotos = existingPhotos.slice(1);
    const nextPrimaryPhoto = formData.primaryPhoto.trim();
    const photos = nextPrimaryPhoto
      ? [nextPrimaryPhoto, ...remainingPhotos]
      : remainingPhotos;
    const currentLifestyle =
      profile?.lifestyle_interests && typeof profile.lifestyle_interests === "object"
        ? profile.lifestyle_interests
        : {};

    try {
      setIsSaving(true);
      setSaveError(null);

      const { error: updateError } = await updateProfile({
        full_name: formData.full_name.trim(),
        location: formData.location.trim(),
        bio: formData.bio.trim(),
        gender_identity: formData.gender_identity.trim(),
        sexual_orientation: formData.sexual_orientation.trim(),
        interests,
        photos,
        lifestyle_interests: {
          ...currentLifestyle,
          voice_intro_script: formData.voiceIntroScript.trim(),
          voice_intro_seconds: voiceIntroSeconds,
        },
        updated_at: new Date().toISOString(),
      });

      if (updateError) {
        setSaveError(updateError);
        return;
      }

      setEditing(false);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to update profile";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const stopVoiceIntroRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (voiceIntroTimeoutRef.current) {
      window.clearTimeout(voiceIntroTimeoutRef.current);
      voiceIntroTimeoutRef.current = null;
    }
    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  const clearVoiceIntro = () => {
    const storageKey = getVoiceIntroStorageKey(user?.id);
    if (storageKey && typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
    setVoiceIntroAudio("");
    setVoiceIntroSeconds(0);
    setFormData((prev) => ({ ...prev, voiceIntroScript: "" }));
  };

  const startVoiceIntroRecording = async () => {
    if (!user?.id || isRecordingVoiceIntro || !voiceIntroSupported) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;
      voiceIntroChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          voiceIntroChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const durationMs = recordingStartedAtRef.current
          ? Date.now() - recordingStartedAtRef.current
          : MAX_VOICE_INTRO_SECONDS * 1000;
        const nextSeconds = Math.max(1, Math.min(MAX_VOICE_INTRO_SECONDS, Math.round(durationMs / 1000)));
        const blob = new Blob(voiceIntroChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const dataUrl = await blobToDataUrl(blob);
        const storageKey = getVoiceIntroStorageKey(user.id);

        if (storageKey && typeof window !== "undefined") {
          window.localStorage.setItem(storageKey, dataUrl);
        }

        setVoiceIntroAudio(dataUrl);
        setVoiceIntroSeconds(nextSeconds);
        setIsRecordingVoiceIntro(false);

        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        voiceIntroChunksRef.current = [];
      };

      recorder.start();
      setIsRecordingVoiceIntro(true);

      voiceIntroTimeoutRef.current = window.setTimeout(() => {
        void stopVoiceIntroRecording();
      }, MAX_VOICE_INTRO_SECONDS * 1000);
    } catch (recordError: any) {
      console.error("Voice intro recording failed:", recordError);
      toast({
        title: "Voice intro unavailable",
        description: recordError?.message || "Microphone access is required to record your intro.",
        variant: "destructive",
      });
    }
  };

  const handleLike = async () => {
    if (!user || !otherUserId) return;

    try {
      setLikeLoading(true);
      setLikeError(null);

      const { error: likeError } = await supabase
        .from("likes")
        .insert({
          liker_id: user.id,
          liked_id: otherUserId,
        });

      // If unique constraint already exists, treat as already liked.
      if (likeError && likeError.code !== "23505") throw likeError;
      setLiked(true);

      // Check whether they already liked me.
      const { data: theirLike, error: theirLikeErr } = await supabase
        .from("likes")
        .select("id")
        .eq("liker_id", otherUserId)
        .eq("liked_id", user.id)
        .maybeSingle();

      if (theirLikeErr) {
        console.warn("theirLike check failed:", theirLikeErr.message);
      }

      if (theirLike) {
        // Keep canonical order in this project schema.
        const a = user.id < otherUserId ? user.id : otherUserId;
        const b = user.id < otherUserId ? otherUserId : user.id;

        const { error: matchCreateErr } = await supabase
          .from("matches")
          .insert({ user1_id: a, user2_id: b });

        // Unique conflict means match already exists, which is okay.
        if (matchCreateErr && matchCreateErr.code !== "23505") {
          console.warn("match create failed:", matchCreateErr.message);
        }
      }

      // Load match after like to capture conversation_id if present.
      const a = user.id < otherUserId ? user.id : otherUserId;
      const b = user.id < otherUserId ? otherUserId : user.id;

      const { data: matchRow, error: matchLookupErr } = await supabase
        .from("matches")
        .select("id, conversation_id")
        .eq("user1_id", a)
        .eq("user2_id", b)
        .maybeSingle();

      if (matchLookupErr) {
        console.warn("match lookup failed:", matchLookupErr.message);
      }

      setMatched(!!matchRow);
      setMatchConversationId(matchRow?.conversation_id ?? null);

      if (matchRow) {
        toast({
          title: "It's a match 💜",
          description: "You can message them now.",
        });
      } else {
        toast({
          title: "Liked",
          description: "We’ll let you know if it’s a match.",
        });
      }
    } catch (likeSubmitError: any) {
      console.error("Error liking profile:", likeSubmitError);
      setLikeError(likeSubmitError?.message || "Please try again.");
      toast({
        title: "Could not like profile",
        description: likeSubmitError?.message || "Please try again.",
      });
    } finally {
      setLikeLoading(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!user?.id || !otherUserId) return;

    try {
      setBlockLoading(true);

      const { data: ownRow, error: ownErr } = await supabase
        .from("profiles")
        .select("safety_settings")
        .eq("id", user.id)
        .maybeSingle();

      if (ownErr) throw ownErr;

      const safety =
        ownRow?.safety_settings && typeof ownRow.safety_settings === "object"
          ? (ownRow.safety_settings as Record<string, any>)
          : {};

      const blockedSet = new Set(toStringArray(safety.blocked_user_ids));
      const willBlock = !blockedSet.has(otherUserId);

      if (willBlock) {
        blockedSet.add(otherUserId);
      } else {
        blockedSet.delete(otherUserId);
      }

      const nowIso = new Date().toISOString();

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          safety_settings: {
            ...safety,
            blocked_user_ids: Array.from(blockedSet),
            blocked_users_updated_at: nowIso,
          },
          updated_at: nowIso,
        })
        .eq("id", user.id);

      if (updateErr) throw updateErr;

      setIsBlocked(willBlock);
      if (willBlock) {
        toast({
          title: "User blocked",
          description: `${displayName} has been blocked.`,
        });
      } else {
        toast({
          title: "User unblocked",
          description: `${displayName} has been unblocked.`,
        });
      }
    } catch (blockError: any) {
      console.error("Could not update block status:", blockError);
      toast({
        title: "Block update failed",
        description: blockError?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBlockLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-calm min-h-screen flex items-center justify-center p-4">
        <div className="glass-pride rounded-2xl p-6 w-full max-w-md text-center relative z-10">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-white" />
          <p className="text-white/90">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    const isMeRoute = !id; // /profile
    return (
      <div className="page-calm min-h-screen flex items-center justify-center p-4">
        <Card className="bg-black/70 border-white/15 text-white w-full max-w-md relative z-10">
          <CardContent className="p-6 text-center space-y-3">
            <div className="text-xl font-semibold">No profile found</div>
            <div className="text-white/80">
              {isMeRoute
                ? "You haven’t created your profile yet."
                : "This profile might not exist or is unavailable."}
            </div>

            {isMeRoute ? (
              <Button
                className="w-full"
                onClick={() => navigate("/create-new-profile")}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Create your profile
              </Button>
            ) : (
              <Button className="w-full" variant="outline" onClick={() => navigate("/social")}>
                Back to Social
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-calm min-h-screen p-4">
      <div className="max-w-2xl mx-auto space-y-6 relative z-10">
        {/* Header card */}
        <Card className="glass-pride-strong text-white overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center gap-4">
              <Avatar className="w-28 h-28 border-2 border-white/20">
                {profilePhoto ? <AvatarImage src={profilePhoto} /> : null}
                <AvatarFallback className="bg-white/10 text-white text-xl font-semibold">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>

              <div>
                <div className="text-2xl font-semibold">
                  {displayName}
                  {age != null ? `, ${age}` : ""}
                </div>

                {profile.location ? (
                  <div className="flex items-center justify-center gap-1 text-white/80 mt-2">
                    <MapPin className="w-4 h-4" />
                    <span>{profile.location}</span>
                  </div>
                ) : null}
              </div>

              {/* tags */}
              <div className="flex flex-wrap gap-2 justify-center">
                {profile.gender_identity ? (
                  <Badge className="bg-white/10 border-white/15 text-white">
                    {profile.gender_identity}
                  </Badge>
                ) : null}
                {profile.sexual_orientation ? (
                  <Badge className="bg-white/10 border-white/15 text-white">
                    {profile.sexual_orientation}
                  </Badge>
                ) : null}

                {(profile.interests || []).slice(0, 10).map((interest: string, idx: number) => (
                  <Badge
                    key={`${interest}-${idx}`}
                    className="bg-white/10 border-white/15 text-white"
                  >
                    {interest}
                  </Badge>
                ))}
              </div>

              {socialProofItems.length > 0 ? (
                <div className="grid w-full gap-3 sm:grid-cols-2">
                  {socialProofItems.map((item) => (
                    <div
                      key={`${item.label}-${item.value}`}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-pink-200/80">
                        {item.label}
                      </div>
                      <div className="mt-2 text-sm font-medium text-white">
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="w-full">
                <ProfileSafetyScore
                  data={{
                    profileCompleted: profile.profileCompleted ?? profile.profile_completed,
                    privacySettings: livePrivacySettings ?? profile.privacy ?? profile.privacy_settings,
                    safetySettings: profile.safety ?? profile.safety_settings,
                  }}
                  displayName={displayName}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <KindnessEndorsements
          profileId={profile.id}
          displayName={displayName}
          currentUserId={user?.id}
          isOwnProfile={isOwnProfile}
          privacySettings={livePrivacySettings ?? profile.privacy ?? profile.privacy_settings}
          onUpdated={setLivePrivacySettings}
        />

        {/* About */}
        <Card className="glass-pride text-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              About
              <div className="flex items-center gap-2">
                {isOwnProfile ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/10"
                    onClick={() => {
                      if (editing) {
                        cancelEditing();
                        return;
                      }
                      startEditing();
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    {editing ? "Cancel" : "Edit"}
                  </Button>
                ) : (
                  <ProfileMenu userId={profile.id} userName={displayName} />
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/90 leading-relaxed whitespace-pre-wrap">
              {(profile.bio || "").trim() || "No bio yet."}
            </p>
          </CardContent>
        </Card>

        {hasVoiceIntro ? (
          <Card className="glass-pride text-white">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                Voice Intro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {voiceIntroAudio ? (
                <div className="rounded-2xl border border-pink-300/20 bg-white/5 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm text-pink-100">
                    <PlayCircle className="w-4 h-4" />
                    {voiceIntroSeconds > 0 ? `${voiceIntroSeconds}-second intro` : "Tap to listen"}
                  </div>
                  <audio controls className="w-full" src={voiceIntroAudio} />
                </div>
              ) : null}

              {voiceIntroText ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/85">
                  “{voiceIntroText}”
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {isOwnProfile && editing && (
          <Card className="glass-pride text-white">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Edit className="w-4 h-4" />
                Edit Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {saveError && (
                <div className="text-sm text-pink-200 bg-pink-900/20 border border-pink-400/30 rounded-md px-3 py-2">
                  {saveError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="profile-full-name">Display Name</Label>
                  <Input
                    id="profile-full-name"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    className="bg-black/30 border-white/20 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="profile-location">Location</Label>
                  <Input
                    id="profile-location"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    className="bg-black/30 border-white/20 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="profile-gender">Gender Identity</Label>
                  <Input
                    id="profile-gender"
                    name="gender_identity"
                    value={formData.gender_identity}
                    onChange={handleChange}
                    className="bg-black/30 border-white/20 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="profile-orientation">Sexual Orientation</Label>
                  <Input
                    id="profile-orientation"
                    name="sexual_orientation"
                    value={formData.sexual_orientation}
                    onChange={handleChange}
                    className="bg-black/30 border-white/20 text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="profile-bio">Bio</Label>
                <Textarea
                  id="profile-bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={4}
                  className="bg-black/30 border-white/20 text-white resize-none"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="profile-interests">Interests (comma separated)</Label>
                <Input
                  id="profile-interests"
                  name="interestsText"
                  value={formData.interestsText}
                  onChange={handleChange}
                  className="bg-black/30 border-white/20 text-white"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="profile-photo" className="flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Primary Photo URL
                </Label>
                <Input
                  id="profile-photo"
                  name="primaryPhoto"
                  type="url"
                  value={formData.primaryPhoto}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="bg-black/30 border-white/20 text-white"
                />
              </div>

              <div className="rounded-2xl border border-pink-300/20 bg-white/5 p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-lg font-semibold text-white">
                    <Mic className="w-4 h-4 text-pink-300" />
                    Profile Voice Intro
                  </div>
                  <p className="text-sm text-white/70">
                    Add a 10–15 second voice intro so people can hear your energy before they read your profile.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="profile-voice-intro-script">Intro transcript</Label>
                  <Textarea
                    id="profile-voice-intro-script"
                    name="voiceIntroScript"
                    value={formData.voiceIntroScript}
                    onChange={handleChange}
                    rows={3}
                    placeholder={`Hi! I'm Maya. I love hiking, dogs, and finding cozy coffee shops.`}
                    className="bg-black/30 border-white/20 text-white resize-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    onClick={() => void (isRecordingVoiceIntro ? stopVoiceIntroRecording() : startVoiceIntroRecording())}
                    className={isRecordingVoiceIntro ? "bg-red-500 hover:bg-red-400" : "bg-pink-500 hover:bg-pink-400"}
                    disabled={!voiceIntroSupported}
                  >
                    {isRecordingVoiceIntro ? (
                      <>
                        <Square className="w-4 h-4 mr-2" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4 mr-2" />
                        Record 15s Intro
                      </>
                    )}
                  </Button>

                  {voiceIntroAudio ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/20 text-white hover:bg-white/10"
                      onClick={clearVoiceIntro}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove Voice Intro
                    </Button>
                  ) : null}

                  <Badge className="bg-white/10 border-white/15 text-white">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Voices build trust faster than text
                  </Badge>
                </div>

                {!voiceIntroSupported ? (
                  <div className="text-sm text-pink-200 bg-pink-900/20 border border-pink-400/30 rounded-md px-3 py-2">
                    Voice recording is not available on this device yet.
                  </div>
                ) : null}

                {voiceIntroAudio ? (
                  <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                    <div className="mb-2 text-sm text-white/70">
                      Preview
                      {voiceIntroSeconds > 0 ? ` · ${voiceIntroSeconds}s` : ""}
                    </div>
                    <audio controls className="w-full" src={voiceIntroAudio} />
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={() => void handleSubmit()} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>

                <Button
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  onClick={cancelEditing}
                  disabled={isSaving}
                >
                  Cancel
                </Button>

                <Button
                  variant="ghost"
                  className="text-white/80 hover:text-white hover:bg-white/10"
                  onClick={() => navigate("/edit-profile", { state: { isEditing: true } })}
                  disabled={isSaving}
                >
                  Open Advanced Editor
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-3 pb-8">
          {isOwnProfile ? (
            <>
              <Button
                className="w-full"
                onClick={() => {
                  if (editing) {
                    cancelEditing();
                    return;
                  }
                  startEditing();
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                {editing ? "Close inline editor" : "Edit my profile"}
              </Button>

              <Button
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10"
                onClick={() => navigate("/subscription")}
              >
                <Star className="w-4 h-4 mr-2" />
                Upgrade to 💜 Violets Verified Plus
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <Button
                variant="outline"
                className={`w-full ${
                  isBlocked
                    ? "border-emerald-300/30 text-emerald-100 hover:bg-emerald-500/10"
                    : "border-red-300/40 text-red-100 hover:bg-red-500/10"
                }`}
                onClick={handleToggleBlock}
                disabled={blockLoading}
              >
                <Ban className="w-4 h-4 mr-2" />
                {blockLoading
                  ? "Updating…"
                  : isBlocked
                    ? "Unblock user"
                    : "Block user"}
              </Button>

              {isBlocked ? (
                <div className="text-sm text-white/80 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  You blocked this user. Unblock to see messaging and match actions again.
                </div>
              ) : null}

              {isBlocked ? null : matched ? (
                <>
                  <div className="text-sm text-white/80 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                    Matched 💜 You can message each other.
                  </div>

                  <MessageButton
                    userId={profile.id}
                    userName={displayName}
                    className="w-full"
                  />
                </>
              ) : (
                <>
                  <Button
                    className="w-full bg-pink-500 hover:bg-pink-600"
                    onClick={handleLike}
                    disabled={likeLoading || liked}
                  >
                    {likeLoading ? "Liking…" : liked ? "Liked 💜" : "Like this person 💜"}
                  </Button>

                  <MessageButton
                    userId={profile.id}
                    userName={displayName}
                    className="w-full"
                  />

                  {likeError && (
                    <div className="text-sm text-pink-200 bg-pink-900/20 border border-pink-400/30 rounded-md px-3 py-2">
                      {likeError}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
