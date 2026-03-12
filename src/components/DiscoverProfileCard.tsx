import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import type { ProfileRow } from "@/lib/profiles";
import ProfileSafetyScore from "./ProfileSafetyScore";
import { KindnessReputationPill } from "./KindnessEndorsements";
import { useI18n } from "@/lib/i18n";

export function DiscoverProfileCard({ profile }: { profile: ProfileRow }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [imageFailed, setImageFailed] = React.useState(false);

  const name = profile.full_name || t("memberFallback");
  const bio = (profile.bio || "").trim();
  const photo = profile.photos?.[0];
  const showPhoto = !!photo && !imageFailed;
  const privacy = (profile.privacy_settings ?? {}) as Record<string, any>;
  const socialCircles = Array.isArray(privacy.social_circles)
    ? privacy.social_circles.filter((value: unknown): value is string => typeof value === "string")
    : [];
  const trustCount =
    typeof privacy.trusted_endorsements_count === "number"
      ? privacy.trusted_endorsements_count
      : Array.isArray(privacy.trusted_endorsements)
        ? privacy.trusted_endorsements.length
        : 0;
  const socialProofItems = [
    socialCircles[0]
      ? { label: t("circleMember"), value: `${socialCircles[0]} Circle` }
      : null,
    trustCount > 0
      ? {
          label: t("trustedConnection"),
          value: trustCount >= 5 ? t("communityEndorsed") : t("trustGrowing"),
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <Card className="glass-pride overflow-hidden border-white/10 text-white shadow-xl">
      {showPhoto ? (
        <div className="h-44 w-full">
          <img
            src={photo}
            alt={name}
            className="h-44 w-full object-cover"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        </div>
      ) : (
        <div className="h-44 w-full bg-white/5 flex items-center justify-center text-white/60">
          {t("noPhotoYet")}
        </div>
      )}

      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="font-semibold">{name}</div>
          {profile.location ? (
            <div className="text-xs text-white/70">{profile.location}</div>
          ) : null}
        </div>

        <ProfileSafetyScore
          compact
          data={{
            profileCompleted: profile.profile_completed,
            privacySettings: profile.privacy_settings,
            safetySettings: profile.safety_settings,
          }}
        />

        <KindnessReputationPill privacySettings={profile.privacy_settings} />

        {socialProofItems.length > 0 ? (
          <div className="grid gap-2">
            {socialProofItems.map((item) => (
              <div
                key={`${item.label}-${item.value}`}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-pink-200/75">
                  {item.label}
                </div>
                <div className="mt-1 text-sm text-white/92">{item.value}</div>
              </div>
            ))}
          </div>
        ) : null}

        {bio ? (
          <div className="text-sm text-white/85 line-clamp-3">{bio}</div>
        ) : (
          <div className="text-sm text-white/50">{t("noBioYet")}</div>
        )}

        <Button
          className="w-full mt-2"
          onClick={() => navigate(`/profile/${profile.id}`)}
        >
          {t("viewProfile")}
        </Button>
      </CardContent>
    </Card>
  );
}
