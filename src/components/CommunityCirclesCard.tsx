import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CalendarDays,
  HeartHandshake,
  MessageCircleMore,
  PawPrint,
  Sparkles,
  Users,
  BookOpen,
  Mountain,
  Briefcase,
  Rainbow,
  Laptop,
  Palette,
  Baby,
  Leaf,
  Flame,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";

export type Circle = {
  name: string;
  description: string;
  stats: {
    posts: number;
    meetups: number;
    chats: number;
    members: number;
  };
  icon: React.ReactNode;
  tone: string;
  glow: string;
  activity: {
    postsToday: number;
    activeChats: number;
    meetupNote: string;
  };
};

type CircleRuntimeStats = {
  posts: number;
  meetups: number;
  chats: number;
  members: number;
  postsToday: number;
  activeChats: number;
  meetupNote: string;
};

export const communityCircles: Circle[] = [
  {
    name: "Women Who Love Dogs",
    description: "Pup photos, dog-friendly meetups, and low-pressure connection.",
    stats: { posts: 128, meetups: 6, chats: 14, members: 412 },
    icon: <PawPrint className="h-4 w-4" />,
    tone: "from-rose-400/18 to-fuchsia-400/10 border-rose-300/25",
    glow: "shadow-[0_10px_40px_rgba(244,114,182,0.18)]",
    activity: { postsToday: 4, activeChats: 7, meetupNote: "Dog walk this Saturday" },
  },
  {
    name: "Book Lovers",
    description: "Reading sprints, book swap threads, and cozy conversation starters.",
    stats: { posts: 96, meetups: 4, chats: 11, members: 263 },
    icon: <BookOpen className="h-4 w-4" />,
    tone: "from-emerald-400/20 to-sky-400/10 border-emerald-300/25",
    glow: "shadow-[0_10px_40px_rgba(45,212,191,0.18)]",
    activity: { postsToday: 4, activeChats: 6, meetupNote: "Book swap this Saturday" },
  },
  {
    name: "Hiking Friends",
    description: "Trail plans, sunrise walks, and active women looking for real company.",
    stats: { posts: 83, meetups: 9, chats: 8, members: 305 },
    icon: <Mountain className="h-4 w-4" />,
    tone: "from-sky-400/20 to-indigo-400/10 border-sky-300/25",
    glow: "shadow-[0_10px_40px_rgba(74,222,128,0.18)]",
    activity: { postsToday: 3, activeChats: 5, meetupNote: "Trail meetup this Sunday" },
  },
  {
    name: "Healing & Support",
    description: "Gentle check-ins, support posts, and community care without pressure.",
    stats: { posts: 151, meetups: 3, chats: 19, members: 341 },
    icon: <HeartHandshake className="h-4 w-4" />,
    tone: "from-pink-400/20 to-fuchsia-400/10 border-pink-300/25",
    glow: "shadow-[0_10px_40px_rgba(244,114,182,0.2)]",
    activity: { postsToday: 6, activeChats: 8, meetupNote: "Support circle tonight" },
  },
  {
    name: "LGBTQ+ Pride Circle",
    description: "Shared identity, celebration, events, and safe queer community space.",
    stats: { posts: 174, meetups: 7, chats: 16, members: 518 },
    icon: <Rainbow className="h-4 w-4" />,
    tone: "from-fuchsia-400/20 to-indigo-400/10 border-fuchsia-300/25",
    glow: "shadow-[0_10px_40px_rgba(167,139,250,0.22)]",
    activity: { postsToday: 5, activeChats: 9, meetupNote: "Pride meetup this weekend" },
  },
  {
    name: "Women in Tech",
    description: "Career growth, mentorship, product talk, and women building in tech together.",
    stats: { posts: 72, meetups: 5, chats: 12, members: 238 },
    icon: <Laptop className="h-4 w-4" />,
    tone: "from-cyan-400/20 to-violet-400/10 border-cyan-300/25",
    glow: "shadow-[0_10px_40px_rgba(56,189,248,0.2)]",
    activity: { postsToday: 3, activeChats: 6, meetupNote: "Tech coffee next Thursday" },
  },
  {
    name: "Entrepreneurs",
    description: "Ambitious women swapping wins, advice, intros, and accountability.",
    stats: { posts: 68, meetups: 5, chats: 10, members: 204 },
    icon: <Briefcase className="h-4 w-4" />,
    tone: "from-violet-400/20 to-cyan-400/10 border-violet-300/25",
    glow: "shadow-[0_10px_40px_rgba(250,204,21,0.2)]",
    activity: { postsToday: 2, activeChats: 7, meetupNote: "Founder coffee next week" },
  },
  {
    name: "Creative Artists",
    description: "Art shares, inspiration threads, and women making things with heart.",
    stats: { posts: 87, meetups: 4, chats: 9, members: 191 },
    icon: <Palette className="h-4 w-4" />,
    tone: "from-fuchsia-400/18 to-orange-400/10 border-fuchsia-300/25",
    glow: "shadow-[0_10px_40px_rgba(217,70,239,0.2)]",
    activity: { postsToday: 5, activeChats: 6, meetupNote: "Sketch night this Friday" },
  },
  {
    name: "Single Moms Support",
    description: "A steady place for support, practical advice, and friendship with other moms.",
    stats: { posts: 94, meetups: 3, chats: 15, members: 227 },
    icon: <Baby className="h-4 w-4" />,
    tone: "from-rose-400/18 to-orange-400/10 border-rose-300/25",
    glow: "shadow-[0_10px_40px_rgba(251,113,133,0.2)]",
    activity: { postsToday: 4, activeChats: 7, meetupNote: "Support meetup this Sunday" },
  },
  {
    name: "Mindfulness & Meditation",
    description: "Breathwork, grounding, reflection, and softer ways to connect.",
    stats: { posts: 79, meetups: 6, chats: 13, members: 214 },
    icon: <Leaf className="h-4 w-4" />,
    tone: "from-emerald-400/18 to-teal-400/10 border-emerald-300/25",
    glow: "shadow-[0_10px_40px_rgba(52,211,153,0.2)]",
    activity: { postsToday: 3, activeChats: 5, meetupNote: "Meditation circle tomorrow" },
  },
];

const trendingCircleNames = [
  "Women Who Love Dogs",
  "Healing & Support",
  "Entrepreneurs",
  "Hiking Friends",
];

type CommunityCirclesCardProps = {
  activeCircle: string | null;
  joinedCircleNames: string[];
  onSelectCircle: (circleName: string | null) => void;
  onToggleJoin: (circleName: string) => void;
};

const EMPTY_MEETUP_NOTE = "No meetup scheduled yet";

const createEmptyRuntimeStats = (): CircleRuntimeStats => ({
  posts: 0,
  meetups: 0,
  chats: 0,
  members: 0,
  postsToday: 0,
  activeChats: 0,
  meetupNote: EMPTY_MEETUP_NOTE,
});

const isMissingCircleConversationColumns = (error: { message?: string } | null | undefined) => {
  const message = (error?.message || "").toLowerCase();
  return message.includes("kind") || message.includes("circle_name");
};

export const CommunityCirclesCard: React.FC<CommunityCirclesCardProps> = ({
  activeCircle,
  joinedCircleNames,
  onSelectCircle,
  onToggleJoin,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [showSuggestForm, setShowSuggestForm] = useState(false);
  const [suggestedCircleName, setSuggestedCircleName] = useState("");
  const [suggestionNote, setSuggestionNote] = useState("");
  const [submittingSuggestion, setSubmittingSuggestion] = useState(false);
  const [liveStatsByCircle, setLiveStatsByCircle] = useState<Record<string, CircleRuntimeStats>>({});

  const trendingCircles = useMemo(
    () => communityCircles.filter((circle) => trendingCircleNames.includes(circle.name)),
    []
  );
  const circleNames = useMemo(() => communityCircles.map((circle) => circle.name), []);

  const formatMeetupNote = useCallback((title: string, startsAt: string) => {
    const dateText = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(startsAt));
    return `${title} • ${dateText}`;
  }, []);

  const loadLiveStats = useCallback(async () => {
    const seeded = Object.fromEntries(
      communityCircles.map((circle) => [circle.name, createEmptyRuntimeStats()])
    ) as Record<string, CircleRuntimeStats>;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [postResult, eventResult, profileResult, convoResult] = await Promise.all([
      supabase.from("posts").select("circle_name, created_at").in("circle_name", circleNames),
      supabase
        .from("calendar_events")
        .select("circle_name, title, starts_at")
        .in("circle_name", circleNames),
      supabase.from("profiles").select("privacy_settings"),
      supabase
        .from("conversations")
        .select("id, circle_name")
        .eq("kind", "circle")
        .in("circle_name", circleNames),
    ]);

    if (postResult.error) throw postResult.error;
    if (eventResult.error) throw eventResult.error;
    if (profileResult.error) throw profileResult.error;
    if (convoResult.error && !isMissingCircleConversationColumns(convoResult.error)) {
      throw convoResult.error;
    }

    const nextMeetupByCircle = new Map<string, { title: string; startsAt: string }>();

    (postResult.data ?? []).forEach((row: any) => {
      const circleName = row.circle_name as string | null;
      if (!circleName || !seeded[circleName]) return;

      seeded[circleName].posts += 1;
      if (new Date(row.created_at).getTime() >= startOfToday.getTime()) {
        seeded[circleName].postsToday += 1;
      }
    });

    (eventResult.data ?? []).forEach((row: any) => {
      const circleName = row.circle_name as string | null;
      if (!circleName || !seeded[circleName]) return;

      seeded[circleName].meetups += 1;
      const startsAt = row.starts_at as string;
      const startsAtTime = new Date(startsAt).getTime();
      if (startsAtTime < Date.now()) return;

      const existing = nextMeetupByCircle.get(circleName);
      if (!existing || startsAtTime < new Date(existing.startsAt).getTime()) {
        nextMeetupByCircle.set(circleName, {
          title: (row.title as string) || "Upcoming meetup",
          startsAt,
        });
      }
    });

    (profileResult.data ?? []).forEach((row: any) => {
      const privacy =
        row?.privacy_settings && typeof row.privacy_settings === "object"
          ? (row.privacy_settings as Record<string, unknown>)
          : {};

      const circles = Array.isArray(privacy.social_circles)
        ? privacy.social_circles.filter((value): value is string => typeof value === "string")
        : [];

      circles.forEach((circleName) => {
        if (seeded[circleName]) {
          seeded[circleName].members += 1;
        }
      });
    });

    const circleConversationRows = ((convoResult.error && isMissingCircleConversationColumns(convoResult.error))
      ? []
      : convoResult.data ?? []) as Array<{
      id: string;
      circle_name: string | null;
    }>;
    const conversationIds = circleConversationRows.map((row) => row.id);
    const circleNameByConversationId = new Map<string, string>();
    circleConversationRows.forEach((row) => {
      if (row.circle_name) {
        circleNameByConversationId.set(row.id, row.circle_name);
      }
    });

    if (conversationIds.length > 0) {
      const { data: messageRows, error: messageError } = await supabase
        .from("messages")
        .select("conversation_id, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
        .limit(5000);

      if (messageError) throw messageError;

      (messageRows ?? []).forEach((row: any) => {
        const circleName = circleNameByConversationId.get(row.conversation_id as string);
        if (!circleName || !seeded[circleName]) return;

        seeded[circleName].chats += 1;
        if (new Date(row.created_at).getTime() >= last24Hours.getTime()) {
          seeded[circleName].activeChats += 1;
        }
      });
    }

    Object.entries(seeded).forEach(([circleName, stats]) => {
      const nextMeetup = nextMeetupByCircle.get(circleName);
      stats.meetupNote = nextMeetup
        ? formatMeetupNote(nextMeetup.title, nextMeetup.startsAt)
        : EMPTY_MEETUP_NOTE;
    });

    setLiveStatsByCircle(seeded);
  }, [circleNames, formatMeetupNote]);

  useEffect(() => {
    void loadLiveStats();
  }, [loadLiveStats]);

  useEffect(() => {
    let reloadTimer: number | null = null;

    const scheduleReload = () => {
      if (reloadTimer) return;
      reloadTimer = window.setTimeout(() => {
        reloadTimer = null;
        void loadLiveStats();
      }, 350);
    };

    const channel = supabase
      .channel("vv-circle-live-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, scheduleReload)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events" },
        scheduleReload
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, scheduleReload)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        scheduleReload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_members" },
        scheduleReload
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, scheduleReload)
      .subscribe();

    return () => {
      if (reloadTimer) {
        window.clearTimeout(reloadTimer);
      }
      supabase.removeChannel(channel);
    };
  }, [loadLiveStats]);

  const handleInviteFriends = async (circleName: string) => {
    const text = `I just joined the ${circleName} circle on Violets & Vibes. Invite friends to grow this circle.`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${circleName} • Violets & Vibes`,
          text,
        });
        return;
      }

      await navigator.clipboard.writeText(text);
      toast({
        title: "Invite copied",
        description: "The circle invite text is ready to paste anywhere.",
      });
    } catch (error: any) {
      console.error("Could not share circle invite:", error);
      toast({
        title: "Could not share invite",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSuggestCircle = async () => {
    const value = suggestedCircleName.trim();
    if (!value || !user?.id || submittingSuggestion) return;

    try {
      setSubmittingSuggestion(true);

      const { error } = await supabase.from("circle_suggestions").insert({
        user_id: user.id,
        name: value,
        note: suggestionNote.trim() || null,
      });

      if (error) throw error;

      toast({
        title: "Circle suggestion sent",
        description: `${value} was sent for admin review.`,
      });
      setSuggestedCircleName("");
      setSuggestionNote("");
      setShowSuggestForm(false);
    } catch (error: any) {
      console.error("Could not save circle suggestion:", error);
      toast({
        title: "Could not submit suggestion",
        description:
          error?.code === "42P01"
            ? "The suggestion system is not live yet. Apply the latest Supabase migration first."
            : error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmittingSuggestion(false);
    }
  };

  const persistJoinedCircles = useCallback(
    async (nextJoinedCircles: string[]) => {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("privacy_settings")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      const privacy =
        data?.privacy_settings && typeof data.privacy_settings === "object"
          ? (data.privacy_settings as Record<string, unknown>)
          : {};

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          privacy_settings: {
            ...privacy,
            social_circles: nextJoinedCircles,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) throw updateError;
    },
    [user?.id]
  );

  const handleOpenCircle = useCallback(
    async (circleName: string, isJoined: boolean) => {
      if (!user?.id) {
        toast({
          title: "Sign in required",
          description: "Sign in to join a circle and open its chat.",
          variant: "destructive",
        });
        return;
      }

      try {
        if (!isJoined) {
          const nextJoinedCircles = Array.from(new Set([...joinedCircleNames, circleName]));
          await persistJoinedCircles(nextJoinedCircles);
          onToggleJoin(circleName);
        }

        onSelectCircle(circleName);
        navigate(`/chat?circle=${encodeURIComponent(circleName)}`, { replace: false });
      } catch (error: any) {
        console.error("Could not open circle chat:", error);
        toast({
          title: "Could not open circle",
          description:
            error?.message ||
            "The circle feed is available, but the circle chat is not ready yet.",
          variant: "destructive",
        });
      }
    },
    [joinedCircleNames, navigate, onSelectCircle, onToggleJoin, persistJoinedCircles, toast, user?.id]
  );

  return (
    <Card className="overflow-hidden border-white/12 bg-[linear-gradient(135deg,rgba(24,12,50,0.94),rgba(12,18,42,0.94))] text-white shadow-2xl backdrop-blur-md">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-pink-300/25 bg-pink-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-pink-100">
              <Users className="h-3.5 w-3.5" />
              {t("communityCircles")}
            </div>
            <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              {t("datingFriendshipCommunity")}
            </h3>
            <p className="mt-2 max-w-3xl text-sm sm:text-base text-white/75">
              {t("communityCirclesDescription")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="bg-pink-500 text-white hover:bg-pink-400">
              <Sparkles className="mr-2 h-4 w-4" />
              {t("createCircle")}
            </Button>
            <Button
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={() => setShowSuggestForm((prev) => !prev)}
            >
              {t("suggestCircle")}
            </Button>
            <Button
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              {t("browseAllCircles")}
            </Button>
          </div>
        </div>

        {showSuggestForm ? (
          <div className="mb-4 rounded-2xl border border-white/12 bg-white/5 p-4 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
            <div className="text-sm font-semibold text-white">{t("suggestCircle")}</div>
            <div className="mt-1 text-sm text-white/70">{t("suggestCircleHelp")}</div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={suggestedCircleName}
                onChange={(event) => setSuggestedCircleName(event.target.value)}
                placeholder={t("suggestCircleIdea")}
                className="border-white/15 bg-black/20 text-white placeholder:text-white/45"
              />
              <Input
                value={suggestionNote}
                onChange={(event) => setSuggestionNote(event.target.value)}
                placeholder={t("optionalNoteForModerators")}
                className="border-white/15 bg-black/20 text-white placeholder:text-white/45"
              />
              <Button
                type="button"
                onClick={() => void handleSuggestCircle()}
                disabled={!suggestedCircleName.trim() || !user?.id || submittingSuggestion}
                className="bg-pink-500 text-white hover:bg-pink-400"
              >
                {submittingSuggestion ? t("submitting") : t("submitIdea")}
              </Button>
            </div>
            {!user ? (
              <div className="mt-2 text-xs text-white/55">{t("signInToSubmitCircleSuggestion")}</div>
            ) : null}
          </div>
        ) : null}

        <div className="mb-4 rounded-2xl border border-white/12 bg-white/5 p-4 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-pink-100/90">
            <Sparkles className="h-4 w-4 text-pink-300" />
            {t("trendingCircles")}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {trendingCircles.map((circle) => (
              <button
                key={`trending-${circle.name}`}
                type="button"
                onClick={() => onSelectCircle(circle.name)}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-2 text-sm text-white transition hover:bg-white/10"
              >
                <span className="text-base leading-none">🔥</span>
                <span>{circle.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            variant={activeCircle === null ? "secondary" : "outline"}
            className={
              activeCircle === null
                ? "bg-white text-violet-950 hover:bg-white/90"
                : "border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            }
            onClick={() => onSelectCircle(null)}
          >
            {t("allCircles")}
          </Button>
          {communityCircles.map((circle) => (
            <Button
              key={`filter-${circle.name}`}
              variant={activeCircle === circle.name ? "secondary" : "outline"}
              className={
                activeCircle === circle.name
                  ? "bg-pink-200 text-violet-950 hover:bg-pink-100"
                  : "border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              }
              onClick={() => onSelectCircle(circle.name)}
            >
              {circle.name}
            </Button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {communityCircles.map((circle) => {
            const isJoined = joinedCircleNames.includes(circle.name);
            const isActive = activeCircle === circle.name;
            const runtimeStats = liveStatsByCircle[circle.name] ?? createEmptyRuntimeStats();

            return (
              <div
                key={circle.name}
                className={`space-y-6 rounded-[24px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] bg-gradient-to-br ${circle.tone} p-4 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.2)] ${circle.glow} transition duration-200 hover:-translate-y-1 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] hover:shadow-[0_18px_40px_rgba(0,0,0,0.25)] ${isActive ? "ring-2 ring-pink-300/70" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-violet-100">
                      {circle.icon}
                      {t("circle")}
                    </div>
                    <h4 className="mt-3 text-lg font-semibold text-white">{circle.name}</h4>
                    <p className="mt-2 text-sm text-white/78">{circle.description}</p>
                    <div className="mt-3 space-y-1.5 text-sm text-white/78">
                      <div className="flex items-center gap-2">
                        <Flame className="h-4 w-4 text-pink-300" />
                        <span>{t("newPostsToday", { count: runtimeStats.postsToday })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageCircleMore className="h-4 w-4 text-sky-300" />
                        <span>{t("activeChats", { count: runtimeStats.activeChats })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-amber-300" />
                        <span>{runtimeStats.meetupNote}</span>
                      </div>
                    </div>
                  </div>
                  <Badge className="border-white/14 bg-white/8 text-white">
                    {runtimeStats.members} {t("members")}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-white/4 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur-md">
                    <div className="flex items-center gap-2 text-white/70">
                      <MessageCircleMore className="h-4 w-4 text-white/70" />
                      {t("chats")}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">{runtimeStats.chats}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/4 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur-md">
                    <div className="flex items-center gap-2 text-white/70">
                      <CalendarDays className="h-4 w-4 text-white/70" />
                      {t("meetups")}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">{runtimeStats.meetups}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/4 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur-md">
                    <div className="flex items-center gap-2 text-white/70">
                      <Sparkles className="h-4 w-4 text-white/70" />
                      {t("posts")}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">{runtimeStats.posts}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/4 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur-md">
                    <div className="flex items-center gap-2 text-white/70">
                      <Users className="h-4 w-4 text-white/70" />
                      {t("memberList")}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">{runtimeStats.members}</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className={
                      isJoined
                        ? "flex-1 bg-emerald-300 text-emerald-950 hover:bg-emerald-200"
                        : "flex-1 bg-white text-violet-950 hover:bg-white/90"
                    }
                    onClick={() => void handleOpenCircle(circle.name, isJoined)}
                  >
                    {isJoined ? t("openCircle") : t("joinCircle")}
                  </Button>
                </div>

                {isJoined ? (
                  <div className="rounded-2xl border border-pink-300/15 bg-pink-400/10 p-3">
                    <div className="text-sm font-medium text-pink-50">
                      {t("inviteFriendsToGrowThisCircle")}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full border-pink-300/20 bg-white/5 text-pink-50 hover:bg-white/10"
                      onClick={() => void handleInviteFriends(circle.name)}
                    >
                      {t("inviteFriends")}
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default CommunityCirclesCard;
