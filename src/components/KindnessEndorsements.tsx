import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeartHandshake, Share2, ShieldCheck, Sparkles, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { shareBadgeCard } from "@/lib/shareBadgeCard";

const ENDORSEMENT_TYPES = [
  { key: "supportive", label: "Supportive", emoji: "💜" },
  { key: "respectful", label: "Respectful", emoji: "💜" },
  { key: "safe_communicator", label: "Safe communicator", emoji: "💜" },
  { key: "community_builder", label: "Community builder", emoji: "💜" },
] as const;

type EndorsementKey = (typeof ENDORSEMENT_TYPES)[number]["key"];

type KindnessEndorsementsProps = {
  profileId: string;
  displayName: string;
  currentUserId?: string;
  isOwnProfile?: boolean;
  privacySettings?: Record<string, any> | null;
  compact?: boolean;
  onUpdated?: (nextPrivacySettings: Record<string, any>) => void;
};

function toIdArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.map((entry) => `${entry ?? ""}`.trim()).filter(Boolean);
}

function normalizeKindnessEndorsements(privacySettings?: Record<string, any> | null) {
  const raw =
    privacySettings?.kindness_endorsements &&
    typeof privacySettings.kindness_endorsements === "object"
      ? (privacySettings.kindness_endorsements as Record<string, unknown>)
      : {};

  const normalized = Object.fromEntries(
    ENDORSEMENT_TYPES.map(({ key }) => [key, toIdArray(raw[key])])
  ) as Record<EndorsementKey, string[]>;

  const uniqueEndorsers = Array.from(
    new Set(ENDORSEMENT_TYPES.flatMap(({ key }) => normalized[key]))
  );

  return {
    byType: normalized,
    uniqueEndorsers,
    totalCount: ENDORSEMENT_TYPES.reduce((sum, { key }) => sum + normalized[key].length, 0),
  };
}

function getReputationLabel(totalCount: number) {
  if (totalCount >= 10) return "Beloved in community";
  if (totalCount >= 6) return "Kindness standout";
  if (totalCount >= 3) return "Warm signal";
  return "Growing trust";
}

function getShareableKindnessBadge(totalCount: number, byType: Record<EndorsementKey, string[]>) {
  if (byType.community_builder.length >= 3) return "Top Community Builder";
  if (byType.safe_communicator.length >= 3) return "Verified Safe Communicator";
  return getReputationLabel(totalCount);
}

export function KindnessReputationPill({
  privacySettings,
}: {
  privacySettings?: Record<string, any> | null;
}) {
  const summary = useMemo(
    () => normalizeKindnessEndorsements(privacySettings),
    [privacySettings]
  );

  return (
    <div className="flex items-center gap-2">
      <Badge className="border-pink-300/30 bg-pink-400/15 text-pink-50">
        <HeartHandshake className="mr-1.5 h-3.5 w-3.5" />
        Kindness {summary.totalCount}
      </Badge>
      <span className="text-xs text-white/70">{getReputationLabel(summary.totalCount)}</span>
    </div>
  );
}

const KindnessEndorsements: React.FC<KindnessEndorsementsProps> = ({
  profileId,
  displayName,
  currentUserId,
  isOwnProfile = false,
  privacySettings,
  compact = false,
  onUpdated,
}) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState<EndorsementKey | null>(null);
  const summary = useMemo(
    () => normalizeKindnessEndorsements(privacySettings),
    [privacySettings]
  );
  const shareBadge = useMemo(
    () => getShareableKindnessBadge(summary.totalCount, summary.byType),
    [summary]
  );

  const handleShare = async () => {
    const text = `I earned the ${shareBadge} badge on Violets & Vibes.`;

    try {
      const result = await shareBadgeCard({
        badgeTitle: shareBadge,
        badgeSubtitle: text,
        profileName: displayName,
      });
      toast({
        title: result === "shared" ? "Badge shared" : "Badge downloaded",
        description:
          result === "shared"
            ? "Your community badge card is ready to post."
            : "Your community badge card was saved as an image.",
      });
    } catch (error: any) {
      console.error("Could not share kindness badge:", error);
      toast({
        title: "Could not share badge",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleToggleEndorsement = async (key: EndorsementKey) => {
    if (!currentUserId || isOwnProfile || isSaving) return;

    const currentTypeEntries = summary.byType[key];
    const nextTypeEntries = currentTypeEntries.includes(currentUserId)
      ? currentTypeEntries.filter((entry) => entry !== currentUserId)
      : [...currentTypeEntries, currentUserId];

    const nextByType = {
      ...summary.byType,
      [key]: nextTypeEntries,
    };

    const trustedEndorsements = Array.from(
      new Set(ENDORSEMENT_TYPES.flatMap(({ key: entryKey }) => nextByType[entryKey]))
    );

    const nextPrivacySettings = {
      ...(privacySettings ?? {}),
      kindness_endorsements: nextByType,
      trusted_endorsements: trustedEndorsements,
      trusted_endorsements_count: trustedEndorsements.length,
      kindness_endorsements_updated_at: new Date().toISOString(),
    };

    try {
      setIsSaving(key);

      const { error } = await supabase
        .from("profiles")
        .update({
          privacy_settings: nextPrivacySettings,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId);

      if (error) throw error;

      onUpdated?.(nextPrivacySettings);
      toast({
        title: currentTypeEntries.includes(currentUserId)
          ? "Endorsement removed"
          : "Kindness endorsed",
        description: currentTypeEntries.includes(currentUserId)
          ? `You removed your ${ENDORSEMENT_TYPES.find((item) => item.key === key)?.label.toLowerCase()} endorsement for ${displayName}.`
          : `You endorsed ${displayName} as ${ENDORSEMENT_TYPES.find((item) => item.key === key)?.label.toLowerCase()}.`,
      });
    } catch (error: any) {
      console.error("Could not update kindness endorsement:", error);
      toast({
        title: "Could not update endorsement",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(null);
    }
  };

  if (compact) {
    return <KindnessReputationPill privacySettings={privacySettings} />;
  }

  return (
    <div className="rounded-2xl border border-pink-300/20 bg-black/20 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-300/25 bg-pink-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-pink-100">
            <Sparkles className="h-3.5 w-3.5" />
            Kindness Reputation
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="text-3xl font-semibold text-white">{summary.totalCount}</div>
            <Badge className="border-pink-300/30 bg-pink-400/15 text-pink-50">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              {getReputationLabel(summary.totalCount)}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-white/70">
            Character compounds here. Endorsements reward respect, safety, and real community care.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white/80">
          <div className="flex items-center gap-2 font-medium text-white">
            <Users className="h-4 w-4 text-pink-200" />
            {summary.uniqueEndorsers.length} community endorsement{summary.uniqueEndorsers.length === 1 ? "" : "s"}
          </div>
          <div className="mt-1 text-white/60">Respect becomes visible when other women vouch for it.</div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3 w-full border-pink-300/20 bg-black/20 text-pink-50 hover:bg-black/30"
            onClick={() => void handleShare()}
          >
            <Share2 className="mr-2 h-4 w-4" />
            Share {shareBadge}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {ENDORSEMENT_TYPES.map((item) => {
          const count = summary.byType[item.key].length;
          const endorsedByMe = !!currentUserId && summary.byType[item.key].includes(currentUserId);
          return (
            <div key={item.key} className="rounded-2xl border border-white/10 bg-black/15 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-white">
                  <span aria-hidden="true">{item.emoji}</span>
                  <span className="font-medium">{item.label}</span>
                </div>
                <span className="text-sm font-semibold text-pink-100">{count}</span>
              </div>
              <div className="mt-3">
                {isOwnProfile ? (
                  <div className="text-sm text-white/60">Earned through how people experience you in the community.</div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant={endorsedByMe ? "secondary" : "outline"}
                    className="w-full border-white/15 bg-black/20 text-white hover:bg-black/30"
                    disabled={!currentUserId || isSaving === item.key}
                    onClick={() => void handleToggleEndorsement(item.key)}
                  >
                    {isSaving === item.key
                      ? "Saving..."
                      : endorsedByMe
                        ? `Endorsed: ${item.label}`
                        : `Endorse ${item.label}`}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KindnessEndorsements;
