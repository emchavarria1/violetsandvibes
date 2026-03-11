import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import type { ProfileRow } from "@/lib/profiles";
import ProfileSafetyScore from "./ProfileSafetyScore";
import { KindnessReputationPill } from "./KindnessEndorsements";

export function DiscoverProfileCard({ profile }: { profile: ProfileRow }) {
  const navigate = useNavigate();
  const [imageFailed, setImageFailed] = React.useState(false);

  const name = profile.full_name || "Member";
  const bio = (profile.bio || "").trim();
  const photo = profile.photos?.[0];
  const showPhoto = !!photo && !imageFailed;

  return (
    <Card className="bg-violet-950/90 border-violet-400/35 text-white overflow-hidden shadow-xl">
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
          No photo yet
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

        {bio ? (
          <div className="text-sm text-white/85 line-clamp-3">{bio}</div>
        ) : (
          <div className="text-sm text-white/50">No bio yet.</div>
        )}

        <Button
          className="w-full mt-2"
          onClick={() => navigate(`/profile/${profile.id}`)}
        >
          View profile
        </Button>
      </CardContent>
    </Card>
  );
}
