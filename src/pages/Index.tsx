import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchDiscoverProfiles, type ProfileRow } from "@/lib/profiles";
import { DiscoverProfileCard } from "@/components/DiscoverProfileCard";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import BrandPrideCard from "@/components/BrandPrideCard";
import WomenInviteWomenCard from "@/components/WomenInviteWomenCard";
import { useI18n } from "@/lib/i18n";

const Index: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchDiscoverProfiles(user.id);
        setRows(data);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || t("failedToLoadProfiles"));
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [t, user?.id]);

  return (
    <div className="page-calm min-h-screen p-4">
      <div className="max-w-4xl mx-auto relative z-10">
        <BrandPrideCard
          title={t("discover")}
          subtitle={t("findYourPeopleAndFeelTheVibe")}
          points={t("womenCenteredInclusiveSafetyFirstPoints").split("|")}
          description={t("meetPeopleWhoValueConnection")}
          className="mb-5"
          cta={
            user ? (
              <Button asChild className="btn-pride-celebrate">
                <Link to="/social">{t("goToSocial")}</Link>
              </Button>
            ) : (
              <Button asChild className="btn-pride-celebrate">
                <Link to="/signin">{t("signInToStart")}</Link>
              </Button>
            )
          }
        />

        <WomenInviteWomenCard />

        {loading ? (
          <div className="text-white/70 relative z-10">{t("loadingProfiles")}</div>
        ) : error ? (
          <div className="text-pink-200 bg-pink-900/20 border border-pink-400/30 rounded-md px-3 py-2 relative z-10">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-white/70 relative z-10">
            {t("noProfilesFound")} 💜
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
            {rows.map((p) => (
              <DiscoverProfileCard key={p.id} profile={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
