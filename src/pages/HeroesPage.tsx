import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedLogo } from "@/components/AnimatedLogo";
import { CalendarDays, HeartHandshake, MessageCircleHeart, ShieldCheck, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const HeroesPage: React.FC = () => {
  const { t } = useI18n();

  const pillars = [
    {
      icon: ShieldCheck,
      title: t("safetyFirstByDesign"),
      body: t("safetyFirstByDesignBody"),
    },
    {
      icon: MessageCircleHeart,
      title: t("connectionWithIntention"),
      body: t("connectionWithIntentionBody"),
    },
    {
      icon: Users,
      title: t("communityThatRetains"),
      body: t("communityThatRetainsBody"),
    },
  ];

  const featureRows = [
    t("womenCenteredInclusiveSafetyFirstShort"),
    t("communityCirclesForSharedInterests"),
    t("voiceIntrosEventsMeetups"),
    t("respectKindnessTrustSignals"),
  ];

  return (
    <div className="page-calm relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="floating-orb absolute left-8 top-16 h-40 w-40 rounded-full bg-pink-400/30 blur-3xl" />
        <div
          className="floating-orb absolute right-10 top-32 h-32 w-32 rounded-full bg-violet-400/30 blur-3xl"
          style={{ animationDelay: "1.5s" }}
        />
        <div
          className="floating-orb absolute bottom-24 left-1/4 h-44 w-44 rounded-full bg-cyan-400/20 blur-3xl"
          style={{ animationDelay: "3s" }}
        />
        <div
          className="floating-orb absolute bottom-16 right-8 h-36 w-36 rounded-full bg-fuchsia-400/20 blur-3xl"
          style={{ animationDelay: "4.5s" }}
        />
      </div>

      <div
        className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <div className="glass-pride-strong rounded-[30px] border border-white/20 bg-[linear-gradient(180deg,rgba(88,28,135,0.28),rgba(46,16,101,0.22))] shadow-[0_20px_80px_rgba(76,29,149,0.35)]">
          <div className="border-b border-white/10 px-5 py-4 sm:px-8">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-1.5 flex-1 rounded-full bg-rose-400" />
              <span className="h-1.5 flex-1 rounded-full bg-orange-400" />
              <span className="h-1.5 flex-1 rounded-full bg-amber-300" />
              <span className="h-1.5 flex-1 rounded-full bg-emerald-400" />
              <span className="h-1.5 flex-1 rounded-full bg-sky-400" />
              <span className="h-1.5 flex-1 rounded-full bg-indigo-400" />
              <span className="h-1.5 flex-1 rounded-full bg-fuchsia-400" />
            </div>

            <AnimatedLogo
              size="lg"
              variant="global-flow"
              className="mb-4"
              text="Violets & Vibes"
              textClassName="wedding-title vv-global-header-primary vv-global-header-flow text-center"
            />

            <div className="mx-auto max-w-4xl text-center">
              <h1 className="vv-global-header-primary vv-global-header-flow">
                {t("friendshipDatingCommunityWithIntention")}
              </h1>
              <p className="mt-4 text-base text-pink-50/85 sm:text-lg">
                {t("womenCenteredSpace")}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button asChild className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700">
                <Link to="/signin?redirect=%2Fsocial">{t("joinTheCommunity")}</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-violet-300/30 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-white shadow-[0_0_24px_rgba(168,85,247,0.35)] hover:from-violet-500/30 hover:to-fuchsia-500/30 hover:shadow-[0_0_32px_rgba(217,70,239,0.4)]"
              >
                <Link to="/signin?redirect=%2Fsocial&tab=login">
                  <span className="bg-gradient-to-r from-pink-300 via-amber-200 via-emerald-200 via-sky-200 to-fuchsia-300 bg-clip-text text-transparent">
                    {t("signIn")}
                  </span>
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 px-5 py-5 sm:px-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(30,27,75,0.88),rgba(15,23,42,0.92))] text-white shadow-[0_12px_40px_rgba(168,85,247,0.16)]">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Badge className="border-pink-300/30 bg-gradient-to-r from-pink-500/20 to-violet-500/20 text-pink-50">{t("whyItFeelsDifferent")}</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {featureRows.map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900/80 via-fuchsia-950/45 to-violet-950/55 px-4 py-3 text-sm text-white"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-3">
                {pillars.map((pillar) => {
                  const Icon = pillar.icon;
                  return (
                    <Card
                      key={pillar.title}
                      className="border-white/10 bg-[linear-gradient(180deg,rgba(49,46,129,0.9),rgba(15,23,42,0.94))] text-white shadow-[0_12px_32px_rgba(236,72,153,0.14)]"
                    >
                      <CardContent className="p-5">
                        <div className="mb-4 inline-flex rounded-2xl border border-pink-300/25 bg-gradient-to-br from-pink-400/20 to-violet-400/20 p-3">
                          <Icon className="h-5 w-5 text-pink-200" />
                        </div>
                        <div className="text-lg font-medium text-white">{pillar.title}</div>
                        <div className="mt-2 text-sm leading-relaxed text-white/85">{pillar.body}</div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(23,37,84,0.94))] text-white shadow-[0_12px_40px_rgba(59,130,246,0.14)]">
              <CardContent className="p-5">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-gradient-to-r from-cyan-400/15 to-violet-500/15 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-50/80">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {t("inTheApp")}
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-cyan-200/10 bg-gradient-to-r from-slate-900/85 to-sky-950/70 p-4">
                    <div className="text-sm font-medium text-white">{t("eventsAndCalendar")}</div>
                    <div className="mt-1 text-sm text-white/85">
                      {t("eventsAndCalendarBody")}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-violet-200/10 bg-gradient-to-r from-slate-900/85 to-violet-950/70 p-4">
                    <div className="text-sm font-medium text-white">{t("chatsWithPrompts")}</div>
                    <div className="mt-1 text-sm text-white/85">
                      {t("chatsWithPromptsBody")}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-pink-200/10 bg-gradient-to-r from-slate-900/85 to-rose-950/70 p-4">
                    <div className="text-sm font-medium text-white">{t("trustSignals")}</div>
                    <div className="mt-1 text-sm text-white/85">
                      {t("trustSignalsBody")}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-pink-300/15 bg-gradient-to-br from-slate-900/85 to-fuchsia-950/70 p-4">
                    <div className="text-center text-sm text-pink-100">
                      {t("womenCenteredSafetyFirstIdentityInclusive")}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="border-t border-white/10 px-5 py-4 sm:px-8">
            <div className="grid grid-cols-2 gap-3 text-center text-sm sm:grid-cols-4">
              <Link className="text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white" to="/privacy">
                {t("privacyPolicy")}
              </Link>
              <Link className="text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white" to="/terms">
                {t("termsOfService")}
              </Link>
              <Link className="text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white" to="/data-deletion">
                {t("dataDeletion")}
              </Link>
              <Link className="text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white" to="/contact">
                {t("contactUs")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroesPage;
