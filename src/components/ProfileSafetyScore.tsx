import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, HeartHandshake, UserCheck, AlertTriangle, Sparkles } from "lucide-react";
import { Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getVerificationState } from "@/lib/verification";
import { shareBadgeCard } from "@/lib/shareBadgeCard";

type ScoreInput = {
  profileCompleted?: boolean | null;
  safetySettings?: Record<string, any> | null;
  privacySettings?: Record<string, any> | null;
};

type ProfileSafetyScoreProps = {
  data: ScoreInput;
  compact?: boolean;
  displayName?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function countKindnessEndorsements(value: unknown) {
  if (!value || typeof value !== "object") return 0;
  return Object.values(value as Record<string, unknown>).reduce((sum, entry) => {
    return sum + (Array.isArray(entry) ? entry.length : 0);
  }, 0);
}

function buildSafetyScore(data: ScoreInput) {
  const safety = data.safetySettings ?? {};
  const privacy = data.privacySettings ?? {};
  const verification = getVerificationState(safety);

  const endorsements =
    toNumber(privacy.trusted_endorsements_count) ||
    toNumber(safety.community_endorsements_count) ||
    countKindnessEndorsements(privacy.kindness_endorsements) ||
    (Array.isArray(privacy.trusted_endorsements) ? privacy.trusted_endorsements.length : 0);

  const reports =
    toNumber(safety.community_reports_count) ||
    toNumber(safety.reports_against_count) ||
    toNumber(safety.report_count);

  const respectfulMessaging =
    typeof safety.respect_score === "number"
      ? clamp(Math.round(safety.respect_score * 20), 0, 20)
      : reports === 0
        ? 15
        : 5;

  const verificationPoints =
    (verification.photoStatus === "approved" || safety.photoVerification === true ? 25 : 0) +
    (verification.idStatus === "approved" ? 20 : 0);

  const profilePoints = data.profileCompleted ? 15 : 5;
  const endorsementPoints = clamp(endorsements * 4, 0, 20);
  const reportPoints = reports === 0 ? 20 : clamp(20 - reports * 10, 0, 20);

  const score = clamp(
    verificationPoints + profilePoints + endorsementPoints + reportPoints + respectfulMessaging,
    0,
    100
  );

  const badgeLabel =
    score >= 85 ? "Trusted Member" : score >= 70 ? "Respect Verified" : score >= 50 ? "Safety Building" : "New Member";

  return {
    score,
    badgeLabel,
    breakdown: [
      {
        label: "Verification",
        value: verificationPoints,
        icon: ShieldCheck,
        detail:
          verificationPoints >= 45
            ? "Photo and ID checks approved"
            : verificationPoints >= 25
              ? "Photo verification complete"
              : "Verification still in progress",
      },
      {
        label: "Respectful messaging",
        value: respectfulMessaging,
        icon: HeartHandshake,
        detail: reports === 0 ? "No issues on record" : "Signals need review",
      },
      {
        label: "Community endorsements",
        value: endorsementPoints,
        icon: UserCheck,
        detail:
          endorsements > 0
            ? `${endorsements} endorsement${endorsements === 1 ? "" : "s"} from the community`
            : "Endorsements unlock over time",
      },
      {
        label: "Reports",
        value: reportPoints,
        icon: AlertTriangle,
        detail: reports === 0 ? "No reports on record" : `${reports} report${reports === 1 ? "" : "s"} logged`,
      },
    ],
  };
}

export const ProfileSafetyScore: React.FC<ProfileSafetyScoreProps> = ({
  data,
  compact = false,
  displayName,
}) => {
  const { toast } = useToast();
  const result = buildSafetyScore(data);
  const shareLabel =
    result.badgeLabel === "Trusted Member"
      ? "Verified Safe Communicator"
      : result.badgeLabel;

  const handleShare = async () => {
    const text = `I earned the ${shareLabel} badge on Violets & Vibes.`;

    try {
      const result = await shareBadgeCard({
        badgeTitle: shareLabel,
        badgeSubtitle: text,
        profileName: displayName,
      });
      toast({
        title: result === "shared" ? "Badge shared" : "Badge downloaded",
        description:
          result === "shared"
            ? "Your trust badge card is ready to post."
            : "Your trust badge card was saved as an image.",
      });
    } catch (error) {
      console.error("Could not share safety badge:", error);
      toast({
        title: "Could not share badge",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Badge className="border-emerald-300/30 bg-emerald-400/15 text-emerald-50">
          <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
          {result.badgeLabel}
        </Badge>
        <span className="text-xs text-white/70">Safety Score {result.score}</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-300/20 bg-white/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
            <ShieldCheck className="h-3.5 w-3.5" />
            Safety Score
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="text-3xl font-semibold text-white">{result.score}</div>
            <Badge className="border-emerald-300/30 bg-emerald-400/15 text-emerald-50">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {result.badgeLabel}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-white/70">
            Trust is earned here through verification, kindness, and steady community signals.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-emerald-300/30 bg-white/5 text-emerald-50 hover:bg-white/10"
          onClick={() => void handleShare()}
        >
          <Share2 className="mr-2 h-4 w-4" />
          Share badge
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {result.breakdown.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-black/15 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-white">
                  <Icon className="h-4 w-4 text-emerald-200" />
                  <span className="font-medium">{item.label}</span>
                </div>
                <span className="text-sm font-semibold text-emerald-100">{item.value}</span>
              </div>
              <div className="mt-2 text-sm text-white/65">{item.detail}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProfileSafetyScore;
