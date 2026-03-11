import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Heart, MessageCircle, Calendar, Settings } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: string;
  post_id: string | null;
  comment_id: string | null;
  created_at: string;
  read_at: string | null;
};

type HydratedNotification = NotificationRow & {
  actorName?: string;
  postTitle?: string | null;
  postSnippet?: string | null;
};

function displayNameFromProfile(p: any) {
  return p?.full_name || p?.name || p?.username || null;
}

function makePostSnippet(title?: string | null, body?: string | null) {
  const base = (title && title.trim()) ? title.trim() : (body || "").trim();
  if (!base) return null;
  return base.length > 90 ? base.slice(0, 90) + "…" : base;
}

function timeAgo(iso?: string) {
  if (!iso) return "just now";
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

function isUnread(n: HydratedNotification) {
  return !n.read_at;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfThisWeek() {
  const d = new Date();
  const day = d.getDay(); // 0 Sun ... 6 Sat
  const diff = (day + 6) % 7; // make Monday start
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function groupKey(n: HydratedNotification) {
  const unread = !n.read_at;
  if (unread) return "New";

  const t = new Date(n.created_at).getTime();
  if (t >= startOfToday()) return "Today";
  if (t >= startOfThisWeek()) return "This week";
  return "Earlier";
}

const GROUP_ORDER = ["New", "Today", "This week", "Earlier"] as const;

function getIcon(type: string) {
  if (type === "post_like" || type === "match") {
    return <Heart className="w-5 h-5 text-pink-300" />;
  }
  if (type === "new_post") {
    return <MessageCircle className="w-5 h-5 text-pink-200" />;
  }
  if (type === "post_comment" || type === "comment_reply" || type === "message") {
    return <MessageCircle className="w-5 h-5 text-cyan-200" />;
  }
  if (type === "event") return <Calendar className="w-5 h-5 text-purple-200" />;
  return <Bell className="w-5 h-5 text-white/70" />;
}

function snippet(text?: string | null, max = 80) {
  const t = (text ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

const NotificationCenter: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<HydratedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actorNameById, setActorNameById] = useState<Record<string, string>>({});
  const [postSnippetById, setPostSnippetById] = useState<Record<string, string>>({});
  const [commentSnippetById, setCommentSnippetById] = useState<Record<string, string>>({});
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  // UI-only toggle (real push later)
  const [pushEnabled, setPushEnabled] = useState(true);

  const formatNotification = (n: any) => {
    const actor = n.actorName || (n.actor_id ? actorNameById[n.actor_id] : undefined) || "Someone";
    const snippet = n.postSnippet ? `“${n.postSnippet}”` : "";

    switch (n.type) {
      case "post_like":
        return {
          title: `${actor} liked your post`,
          message: snippet || "Your post got a new like.",
        };
      case "post_comment":
        return {
          title: `${actor} commented on your post`,
          message: snippet || "Someone commented on your post.",
        };
      case "comment_reply":
        return {
          title: `${actor} replied`,
          message: "Someone replied to your comment.",
        };
      case "new_post":
        return {
          title: `${actor} posted`,
          message: snippet || "A new post appeared in your feed.",
        };
      default:
        return {
          title: "Notification",
          message: "",
        };
    }
  };

  const hydrateNotifications = async (rows: NotificationRow[]) => {
    if (!rows.length) return [] as HydratedNotification[];

    const actorIds = Array.from(new Set(rows.map(r => r.actor_id).filter(Boolean))) as string[];
    const postIds = Array.from(new Set(rows.map(r => r.post_id).filter(Boolean))) as string[];

    // Fetch actor names from profiles (best effort)
    let profiles: any[] = [];
    if (actorIds.length) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .in("id", actorIds);

      if (!error) profiles = data ?? [];
      else console.warn("profiles hydrate failed:", error.message);
    }

    const nameById = new Map<string, string>();
    profiles.forEach((p: any) => {
      nameById.set(p.id, p.full_name || p.username || "Someone");
    });
    if (nameById.size > 0) {
      const nextActorMap: Record<string, string> = {};
      nameById.forEach((v, k) => {
        nextActorMap[k] = v;
      });
      setActorNameById((prev) => ({ ...prev, ...nextActorMap }));
    }

    // Fetch post snippets (best effort)
    let posts: any[] = [];
    if (postIds.length) {
      const { data, error } = await supabase
        .from("posts")
        .select("id, title, body")
        .in("id", postIds);

      if (!error) posts = data ?? [];
      else console.warn("posts hydrate failed:", error.message);
    }

    const postById = new Map<string, { title: string | null; body: string | null }>();
    posts.forEach((p: any) => {
      postById.set(p.id, { title: p.title ?? null, body: p.body ?? null });
    });
    if (postById.size > 0) {
      const nextSnippetMap: Record<string, string> = {};
      postById.forEach((v, k) => {
        const s = makePostSnippet(v.title, v.body);
        if (s) nextSnippetMap[k] = s;
      });
      setPostSnippetById((prev) => ({ ...prev, ...nextSnippetMap }));
    }

    return rows.map((n) => {
      const post = n.post_id ? postById.get(n.post_id) : null;

      return {
        ...n,
        actorName: n.actor_id ? (nameById.get(n.actor_id) || "Someone") : "Someone",
        postTitle: post?.title ?? null,
        postSnippet: makePostSnippet(post?.title ?? null, post?.body ?? null),
      } as HydratedNotification;
    });
  };

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications]
  );
  const readCount = useMemo(
    () => notifications.filter((n) => !!n.read_at).length,
    [notifications]
  );
  const visibleNotifications = useMemo(() => {
    const source = showUnreadOnly
      ? notifications.filter((n) => !n.read_at)
      : notifications;

    if (showUnreadOnly) return source;

    const unread = source.filter((n) => !n.read_at);
    const read = source.filter((n) => !!n.read_at).slice(0, 20);
    return [...unread, ...read];
  }, [notifications, showUnreadOnly]);
  const grouped = useMemo(() => {
    const map = new Map<string, HydratedNotification[]>();
    (visibleNotifications ?? []).forEach((n) => {
      const k = groupKey(n);
      map.set(k, [...(map.get(k) ?? []), n]);
    });

    return GROUP_ORDER
      .map((k) => ({ key: k, items: map.get(k) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [visibleNotifications]);

  const loadNotifications = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error: loadError } = await supabase
      .from("notifications")
      .select("id, recipient_id, actor_id, type, post_id, comment_id, created_at, read_at")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (loadError) {
      console.error("loadNotifications error:", loadError);
      setError(loadError.message);
      setLoading(false);
      return;
    }

    const hydrated = await hydrateNotifications((data ?? []) as NotificationRow[]);

    setNotifications(hydrated);
    setError(null);
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    if (!user) return;

    // optimistic
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? now } : n))
    );

    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("recipient_id", user.id)
      .eq("id", id)
      .is("read_at", null);

    if (updateError) {
      console.error("markAsRead error:", updateError);
      // revert to truth
      await loadNotifications();
    }
  };

  const markAllRead = async () => {
    if (!user) return;

    const now = new Date().toISOString();

    // optimistic
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));

    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("recipient_id", user.id)
      .is("read_at", null);

    if (updateError) {
      console.error("markAllRead error:", updateError);
      await loadNotifications();
    }
  };

  const clearRead = async () => {
    if (!user) return;

    const previous = notifications;
    const readIds = notifications.filter((n) => !!n.read_at).map((n) => n.id);
    if (readIds.length === 0) return;

    setNotifications((prev) => prev.filter((n) => !n.read_at));

    const { error: deleteError } = await supabase
      .from("notifications")
      .delete()
      .eq("recipient_id", user.id)
      .not("read_at", "is", null);

    if (deleteError) {
      console.error("clearRead error:", deleteError);
      setNotifications(previous);
      return;
    }
  };

  const openNotification = async (n: any) => {
    if (isUnread(n)) await markAsRead(n.id);

    const t = encodeURIComponent(n.type || "");
    const params = new URLSearchParams();

    if (n.post_id) params.set("post", n.post_id);
    if (n.comment_id) params.set("focusComment", n.comment_id);
    if (n.type === "post_comment" || n.type === "comment_reply") {
      params.set("comments", "1");
    }
    if (t) params.set("t", t);

    navigate(`/social?${params.toString()}`);
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      setError(null);
      return;
    }

    void loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("vv-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        async (payload) => {
          const row = (payload as any).new as HydratedNotification;
          if (!row || row.recipient_id !== user.id) return;
          (async () => {
            const hydrated = await hydrateNotifications([row as NotificationRow]);
            setNotifications((prev) => [hydrated[0], ...prev]);
          })();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        async (payload) => {
          const row = (payload as any).new as HydratedNotification;
          if (!row || row.recipient_id !== user.id) return;
          const hydrated = await hydrateNotifications([row as NotificationRow]);
          if (!hydrated[0]) return;
          setNotifications((prev) => prev.map((n) => (n.id === row.id ? hydrated[0] : n)));
        }
      )
      .subscribe((status) => console.log("vv-notifications status:", status));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Bell className="w-6 h-6 text-white/90" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </div>

          <h2 className="wedding-heading rainbow-header">Notifications</h2>

          {unreadCount > 0 && (
            <Badge className="bg-pink-500">{unreadCount}</Badge>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/settings")}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      {/* Push toggle (UI only) */}
      <Card className="bg-black/40 border-white/15 text-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Push Notifications</CardTitle>
            <Button
              variant={pushEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setPushEnabled(!pushEnabled)}
              className={pushEnabled ? "bg-green-500 hover:bg-green-600" : ""}
            >
              {pushEnabled ? "On" : "Off"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-white/80">
          {loading
            ? "Loading..."
            : showUnreadOnly
              ? `${unreadCount} unread`
              : `${visibleNotifications.length} shown${readCount > 20 ? ` • ${readCount - 20} older read hidden` : ""}`}
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={showUnreadOnly ? "default" : "outline"}
            onClick={() => setShowUnreadOnly((prev) => !prev)}
            disabled={!user || notifications.length === 0}
            className={showUnreadOnly ? "bg-pink-500 hover:bg-pink-600" : "border-white/20 text-white hover:bg-white/10"}
          >
            {showUnreadOnly ? "Showing unread" : "Unread only"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={markAllRead}
            disabled={!user || unreadCount === 0}
            className="border-white/20 text-white hover:bg-white/10"
          >
            Mark all read
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={clearRead}
            disabled={!user || readCount === 0}
            className="border-white/20 text-white hover:bg-white/10"
          >
            Clear read
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-pink-200 bg-pink-900/20 border border-pink-400/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-white/70">Loading…</div>
        ) : visibleNotifications.length === 0 ? (
          <Card className="bg-black/30 border-white/15 text-white">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <Bell className="w-5 h-5 text-white/70" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">You’re all caught up</div>
                  <div className="text-sm text-white/70 mt-1">
                    {showUnreadOnly
                      ? "No unread notifications right now."
                      : "Likes and comments will show up here as they happen."}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      className="bg-white/10 hover:bg-white/15 text-white"
                      onClick={() => navigate("/social")}
                    >
                      Go to Social
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/20 text-white hover:bg-white/10"
                      onClick={loadNotifications}
                    >
                      Refresh
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          grouped.map((group) => (
            <div key={group.key} className="space-y-3">
              <div className="text-xs uppercase tracking-wide text-white/60 px-1">
                {group.key}
              </div>

              {group.items.map((n) => {
                const { title, message } = formatNotification(n);
                const unread = !n.read_at;

                return (
                  <Card
                    key={n.id}
                    className={`cursor-pointer transition-all bg-black/35 border-white/15 text-white hover:bg-black/45 ${
                      unread ? "ring-1 ring-pink-400/30" : ""
                    }`}
                    onClick={() => openNotification(n)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">{getIcon(n.type)}</div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{title}</p>
                              {message ? (
                                <p className="text-sm text-white/70 mt-1 line-clamp-2">
                                  {message}
                                </p>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-white/60">
                                {timeAgo(n.created_at)}
                              </span>
                              {unread && (
                                <span className="h-2 w-2 rounded-full bg-red-500" />
                              )}
                            </div>
                          </div>

                          {n.type === "post_like" && (
                            <div className="mt-2 text-xs text-white/60">
                              Tap to view the post
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Refresh */}
      <div className="pt-2">
        <Button
          variant="ghost"
          className="w-full text-white/80 hover:text-white hover:bg-white/5"
          onClick={() => void loadNotifications()}
          disabled={!user}
        >
          Refresh
        </Button>
      </div>
    </div>
  );
};

export default NotificationCenter;
