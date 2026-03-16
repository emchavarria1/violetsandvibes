import React, { useEffect, useMemo, useState } from "react";
import { Heart, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { fetchMyMatches, type MatchRow } from "@/lib/matches";
import { getOrCreateDirectConversation } from "@/lib/messaging";
import { loadBlockedUserIdSet } from "@/lib/safety";
import { getPrimaryProfilePhoto } from "@/lib/profiles";
import { getProfileVibeLabel, isProfileVibe } from "@/lib/vibes";

type MatchProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  photos: string[] | null;
  avatar_url?: string | null;
  location: string | null;
};

type UiMatch = {
  matchId: string;
  conversationId: string | null;
  otherUserId: string;
  name: string;
  photo: string | null;
  location: string | null;
  createdAt: string;
  isNewMatch: boolean;
  hasUnread: boolean;
  receivedVibe?: string | null;
  lastMessageText?: string | null;
  lastMessageAt?: string | null;
};

function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

const NEW_MATCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const MatchesView: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [matches, setMatches] = useState<UiMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const blockedUserIdsKey = useMemo(
    () => Array.from(blockedUserIds).sort().join(","),
    [blockedUserIds]
  );

  const toUiMatch = (
    row: MatchRow,
    myId: string,
    prof?: MatchProfileRow,
    receivedVibe?: string | null
  ): UiMatch => {
    const otherUserId = row.user1_id === myId ? row.user2_id : row.user1_id;
    const createdAtMs = new Date(row.created_at).getTime();

    return {
      matchId: row.id,
      conversationId: row.conversation_id,
      otherUserId,
      name: prof?.full_name || prof?.username || "Member",
      photo: getPrimaryProfilePhoto(prof) ?? null,
      location: prof?.location ?? null,
      createdAt: row.created_at,
      hasUnread: false,
      receivedVibe: receivedVibe ?? null,
      lastMessageText: null,
      lastMessageAt: null,
      isNewMatch:
        !Number.isNaN(createdAtMs) && Date.now() - createdAtMs <= NEW_MATCH_WINDOW_MS,
    };
  };

  const openMatchChat = async (match: UiMatch) => {
    if (!user) return;

    try {
      setMatches((prev) =>
        prev.map((m) =>
          m.matchId === match.matchId ? { ...m, hasUnread: false } : m
        )
      );

      let conversationId = match.conversationId;
      if (!conversationId) {
        conversationId = await getOrCreateDirectConversation(user.id, match.otherUserId);
        setMatches((prev) =>
          prev.map((m) =>
            m.matchId === match.matchId ? { ...m, conversationId } : m
          )
        );
      }

      navigate(`/chat?c=${conversationId}`);
    } catch (e: any) {
      console.error("Failed to open chat from match:", e);
      toast({
        title: "Could not open chat",
        description: e?.message || "Please try again.",
      });
    }
  };

  useEffect(() => {
    if (!user) {
      setMatches([]);
      setError(null);
      setLoading(false);
      setBlockedUserIds(new Set());
      return;
    }

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const blockedSet = await loadBlockedUserIdSet(user.id);
        const nextBlockedKey = Array.from(blockedSet).sort().join(",");
        if (nextBlockedKey !== blockedUserIdsKey) {
          setBlockedUserIds(blockedSet);
        }

        const rows = await fetchMyMatches(user.id);
        const visibleRows = rows.filter((row) => {
          const otherUserId = row.user1_id === user.id ? row.user2_id : row.user1_id;
          return !blockedSet.has(otherUserId);
        });

        if (visibleRows.length === 0) {
          setMatches([]);
          return;
        }

        const { data: memRows, error: memErr } = await supabase
          .from("conversation_members")
          .select("conversation_id, last_read_at")
          .eq("user_id", user.id);

        if (memErr) throw memErr;

        const lastReadByConvo = new Map<string, string | null>();
        (memRows ?? []).forEach((m: any) => {
          lastReadByConvo.set(m.conversation_id, m.last_read_at ?? null);
        });

        const otherUserIds = Array.from(
          new Set(
            visibleRows.map((m) => (m.user1_id === user.id ? m.user2_id : m.user1_id))
          )
        );

        let profileRows: MatchProfileRow[] = [];
        if (otherUserIds.length > 0) {
          const { data, error: profileError } = await supabase
            .from("profiles")
            .select("id, full_name, username, photos, avatar_url, location")
            .in("id", otherUserIds);

          if (profileError) throw profileError;
          profileRows = (data ?? []) as MatchProfileRow[];
        }

        const profileById = new Map<string, MatchProfileRow>();
        profileRows.forEach((p) => profileById.set(p.id, p));

        const receivedVibeByUserId = new Map<string, string>();
        if (otherUserIds.length > 0) {
          const { data: receivedVibeRows, error: receivedVibeError } = await supabase
            .from("likes")
            .select("liker_id, vibe")
            .eq("liked_id", user.id)
            .in("liker_id", otherUserIds)
            .not("vibe", "is", null);

          if (receivedVibeError) {
            console.warn("received vibe lookup failed:", receivedVibeError.message);
          } else {
            (receivedVibeRows ?? []).forEach((row: any) => {
              if (typeof row?.liker_id === "string" && isProfileVibe(row?.vibe)) {
                receivedVibeByUserId.set(row.liker_id, row.vibe);
              }
            });
          }
        }

        const uiRows = visibleRows.map((m: MatchRow) => {
          const otherUserId = m.user1_id === user.id ? m.user2_id : m.user1_id;
          const prof = profileById.get(otherUserId);
          return toUiMatch(m, user.id, prof, receivedVibeByUserId.get(otherUserId) ?? null);
        });

        const convoIds = uiRows
          .map((m) => m.conversationId)
          .filter(Boolean) as string[];

        if (convoIds.length > 0) {
          const { data: msgRows, error: msgErr } = await supabase
            .from("messages")
            .select("conversation_id, body, created_at")
            .in("conversation_id", convoIds)
            .order("created_at", { ascending: false })
            .limit(200);

          if (msgErr) {
            console.warn("last message lookup failed:", msgErr.message);
          } else {
            const latestByConvo = new Map<string, { body: string; created_at: string }>();

            for (const r of msgRows ?? []) {
              // Ordered desc: first message seen per conversation is the latest
              if (!latestByConvo.has(r.conversation_id)) {
                latestByConvo.set(r.conversation_id, {
                  body: r.body,
                  created_at: r.created_at,
                });
              }
            }

            uiRows.forEach((m) => {
              if (!m.conversationId) return;
              const latest = latestByConvo.get(m.conversationId);
              if (!latest) return;
              m.lastMessageText = latest.body;
              m.lastMessageAt = latest.created_at;
            });
          }
        }

        uiRows.forEach((m) => {
          if (!m.conversationId) {
            m.hasUnread = false;
            return;
          }

          const lastReadAt = lastReadByConvo.get(m.conversationId) ?? null;
          m.hasUnread =
            !!m.lastMessageAt &&
            (!lastReadAt ||
              new Date(m.lastMessageAt).getTime() > new Date(lastReadAt).getTime());
        });

        uiRows.sort((a, b) => {
          if (a.hasUnread !== b.hasUnread) return a.hasUnread ? -1 : 1;
          const ta = a.lastMessageAt
            ? new Date(a.lastMessageAt).getTime()
            : new Date(a.createdAt).getTime();
          const tb = b.lastMessageAt
            ? new Date(b.lastMessageAt).getTime()
            : new Date(b.createdAt).getTime();
          return tb - ta;
        });

        setMatches(uiRows);
      } catch (e: any) {
        console.error("Failed to load matches:", e);
        setError(e?.message || "Failed to load matches");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [user?.id, blockedUserIdsKey]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`vv-matches-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "matches" },
        async (payload) => {
          const row = (payload as any).new as MatchRow | undefined;
          if (!row) return;
          if (row.user1_id !== user.id && row.user2_id !== user.id) return;

          const otherUserId = row.user1_id === user.id ? row.user2_id : row.user1_id;
          if (blockedUserIds.has(otherUserId)) return;
          const { data: profileRow } = await supabase
            .from("profiles")
            .select("id, full_name, username, photos, avatar_url, location")
            .eq("id", otherUserId)
            .maybeSingle();

          const { data: receivedVibeRow } = await supabase
            .from("likes")
            .select("vibe")
            .eq("liker_id", otherUserId)
            .eq("liked_id", user.id)
            .maybeSingle();

          const ui = toUiMatch(
            row,
            user.id,
            (profileRow as MatchProfileRow | null) ?? undefined,
            isProfileVibe(receivedVibeRow?.vibe) ? receivedVibeRow.vibe : null
          );

          setMatches((prev) => {
            if (prev.some((m) => m.matchId === row.id)) return prev;
            return [ui, ...prev];
          });
          toast({
            title: "New match 💜",
            description: `You matched with ${ui.name}.`,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches" },
        (payload) => {
          const row = (payload as any).new as MatchRow | undefined;
          if (!row) return;
          if (row.user1_id !== user.id && row.user2_id !== user.id) return;

          setMatches((prev) =>
            prev.map((m) =>
              m.matchId === row.id
                ? { ...m, conversationId: row.conversation_id }
                : m
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, toast, blockedUserIdsKey]);

  const newMatches = useMemo(
    () => matches.filter((m) => m.isNewMatch),
    [matches]
  );
  const oldMatches = useMemo(
    () => matches.filter((m) => !m.isNewMatch),
    [matches]
  );

  if (authLoading || loading) {
    return (
      <div className="padding-responsive">
        <div className="text-white/80 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading matches…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="padding-responsive text-white/80">
        Please sign in to see your matches.
      </div>
    );
  }

  if (error) {
    return (
      <div className="padding-responsive">
        <div className="text-pink-200 bg-pink-900/20 border border-pink-400/30 rounded-md px-3 py-2">
          {error}
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="padding-responsive">
        <h2 className="wedding-heading text-lg font-semibold rainbow-header flex items-center">
          <Heart className="w-5 h-5 mr-2 text-red-400" />
          Matches
        </h2>
        <div className="text-white/70 mt-3">
          No matches yet. Keep connecting and check back soon.
        </div>
      </div>
    );
  }

  return (
    <div className="padding-responsive">
      {/* New Matches Section */}
      <div className="mb-6">
        <h2 className="wedding-heading text-lg font-semibold rainbow-header flex items-center">
          <Heart className="w-5 h-5 mr-2 text-red-400" />
          New Matches
        </h2>
        {newMatches.length === 0 ? (
          <div className="text-white/70 text-sm mt-2">No new matches this week.</div>
        ) : (
          <div className="flex space-x-4 overflow-x-auto pb-2">
            {newMatches.map((match) => (
              <div
                key={match.matchId}
                className="flex-shrink-0 text-center"
                role="button"
                tabIndex={0}
                onClick={() => void openMatchChat(match)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void openMatchChat(match);
                  }
                }}
              >
                <div className="relative">
                  {match.photo ? (
                    <img
                      src={match.photo}
                      alt={match.name}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-4 border-pink-400 shadow-lg"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-pink-400 shadow-lg bg-white/10 flex items-center justify-center text-white font-semibold">
                      {match.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -top-1 -right-1 w-6 h-6 btn-pride rounded-full flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                </div>
                <p className="text-sm font-medium text-white mt-2">{match.name}</p>
                {match.location ? (
                  <p className="text-xs text-white/70">{match.location}</p>
                ) : null}
                {match.receivedVibe ? (
                  <p className="mt-1 text-[11px] font-medium text-violet-200">
                    {getProfileVibeLabel(match.receivedVibe)} vibe
                  </p>
                ) : null}
                <div className="mt-2 flex gap-2 justify-center">
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded-md bg-white/10 text-white hover:bg-white/15"
                    onClick={(e) => {
                      e.stopPropagation();
                      void openMatchChat(match);
                    }}
                  >
                    Message
                  </button>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded-md border border-white/20 text-white/90 hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/profile/${match.otherUserId}`);
                    }}
                  >
                    View profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Messages Section */}
      <div>
        <h2 className="wedding-heading text-lg font-semibold rainbow-header flex items-center">
          <MessageCircle className="w-5 h-5 mr-2 text-blue-400" />
          Messages
        </h2>
        {oldMatches.length === 0 ? (
          <div className="text-white/70 text-sm mt-2">No message threads yet.</div>
        ) : (
          <div className="space-y-3">
            {oldMatches.map((match) => (
              <div
                key={match.matchId}
                className="w-full text-left glass-pride-strong p-4 rounded-xl hover:scale-[1.01] transition-all duration-200"
                role="button"
                tabIndex={0}
                onClick={() => void openMatchChat(match)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void openMatchChat(match);
                  }
                }}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    {match.photo ? (
                      <img
                        src={match.photo}
                        alt={match.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-pink-400"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-white/10 border-2 border-pink-400 flex items-center justify-center text-white font-semibold">
                        {match.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    {match.hasUnread && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-white truncate">{match.name}</h3>
                      <span className="text-xs text-white/60 shrink-0">
                        {timeAgo(match.lastMessageAt || match.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-white/80 truncate">
                      {match.lastMessageText
                        ? match.lastMessageText
                        : "Tap to open chat"}
                    </p>
                    {match.receivedVibe ? (
                      <p className="text-xs text-violet-200/90 truncate">
                        Started with a {getProfileVibeLabel(match.receivedVibe)?.toLowerCase()} vibe
                      </p>
                    ) : null}
                    {match.location ? (
                      <p className="text-xs text-white/60 truncate">{match.location}</p>
                    ) : null}
                    <div className="mt-2">
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded-md border border-white/20 text-white/90 hover:bg-white/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/profile/${match.otherUserId}`);
                        }}
                      >
                        View profile
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchesView;
