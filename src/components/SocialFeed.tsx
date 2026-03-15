import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import EventCard from "./EventCard";
import CommunityCirclesCard, { communityCircles } from "./CommunityCirclesCard";
import { Plus, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

type CalendarVisibility = "private" | "shared" | "circle";

type PostRow = {
  id: string;
  author_id: string;
  title: string | null;
  body: string;
  circle_name?: string | null;
  created_at: string;
  updated_at: string | null;
  edited_at: string | null;
  collapsed_by_author: boolean;
};

type FeedPost = PostRow & {
  authorName: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  _optimistic?: boolean;
};

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  parent_comment_id: string | null;
  authorName?: string;
};

type HydratedComment = CommentRow & {
  authorName: string;
  _optimistic?: boolean;
};

type CalendarEventRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  location: string | null;
  circle_name?: string | null;
  visibility: CalendarVisibility;
  starts_at: string;
  ends_at: string;
  source: "local" | "google" | "outlook";
  sync_state: "pending" | "synced" | "error";
};

type FeedEvent = {
  id: string;
  ownerId: string;
  startsAt: string;
  endsAt: string;
  source: "local" | "google" | "outlook";
  visibility: CalendarVisibility;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  attendees: number;
  maxAttendees: number;
  tags: string[];
  organizer: string;
  isAttending: boolean;
  isOwnedByMe: boolean;
  circleName?: string | null;
  requestedByMe: boolean;
  infoRequestCount: number;
  latestInfoRequestMessage: string | null;
};

type EventInfoRequestRow = {
  id: string;
  event_id: string;
  requester_id: string;
  owner_id: string;
  message: string | null;
};

type EventEditForm = {
  title: string;
  description: string;
  location: string;
  visibility: CalendarVisibility;
  circleName: string;
  startsAt: string;
  endsAt: string;
};

function getEventAudienceLabel(event: Pick<CalendarEventRow, "visibility" | "circle_name">) {
  if (event.visibility === "private") return "Private";
  if (event.visibility === "circle") return event.circle_name || "Circle";
  return "Open Community";
}

const CIRCLE_STORAGE_KEY = "vv_joined_circles_v1";
const EVENT_TEMPLATES = [
  {
    label: "Coffee meetup",
    title: "Coffee Meetup",
    description: "Low-pressure coffee and conversation for women who want to meet in real life.",
  },
  {
    label: "Dog park walk",
    title: "Dog Park Walk",
    description: "Bring your dog, take a walk, and meet other women who love dogs.",
  },
  {
    label: "Pride meetup",
    title: "Pride Meetup",
    description: "A joyful LGBTQ+ community meetup for connection, friendship, and celebration.",
  },
  {
    label: "Hiking group",
    title: "Hiking Group",
    description: "Trail time, fresh air, and easy conversation with women who love the outdoors.",
  },
  {
    label: "Book club night",
    title: "Book Club Night",
    description: "Bring your current read and join a cozy discussion with fellow book lovers.",
  },
];

function incMap(map: Map<string, number>, key: string, delta: number) {
  const next = new Map(map);
  next.set(key, Math.max(0, (next.get(key) ?? 0) + delta));
  return next;
}

function timeAgo(iso: string) {
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

function isMissingPostMetadataColumnError(error: unknown) {
  const message = (error as { message?: string })?.message ?? "";
  return (
    message.includes("collapsed_by_author") ||
    message.includes("updated_at") ||
    message.includes("edited_at")
  );
}

const EXPANDED_KEY = "vv_expanded_post_v1";
const POST_AUTO_COLLAPSE_MS = 24 * 60 * 60 * 1000;

function derivePostTitle(body: string) {
  return (
    body
      .split("\n")
      .find((line) => line.trim().length > 0)
      ?.slice(0, 80) || "Post"
  );
}

function formatEventDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function formatEventTimeRange(startIso: string, endIso: string) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(startIso))} - ${formatter.format(new Date(endIso))}`;
}

function toDateTimeLocalValue(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

const SocialFeed: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const location = useLocation();
  const { toast } = useToast();

  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostBody, setEditingPostBody] = useState("");
  const [postActionLoadingById, setPostActionLoadingById] = useState<Record<string, boolean>>({});
  const [expandedBodyByPostId, setExpandedBodyByPostId] = useState<Record<string, boolean>>({});
  const [highlightPostId, setHighlightPostId] = useState<string | null>(null);
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(null);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(EXPANDED_KEY);
    } catch {
      return null;
    }
  });
  const [commentsByPost, setCommentsByPost] = useState<Record<string, HydratedComment[]>>({});
  const [repliesByParentId, setRepliesByParentId] = useState<Record<string, HydratedComment[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyToByPost, setReplyToByPost] = useState<Record<string, string | null>>({});
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [commenting, setCommenting] = useState<Record<string, boolean>>({});
  const [commentsLoadingByPost, setCommentsLoadingByPost] = useState<Record<string, boolean>>({});
  const [commentErrorByPost, setCommentErrorByPost] = useState<Record<string, string | null>>({});
  const focusCommentIdRef = useRef<string | null>(null);
  const highlightPostIdRef = useRef<string | null>(null);
  const expandedPostIdRef = useRef<string | null>(expandedPostId);
  const loadFeedRef = useRef<() => Promise<void>>(async () => {});
  const loadCommentsRef = useRef<(postId: string) => Promise<void>>(async () => {});

  // Events (still mock for now)
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
  });
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventEditForm | null>(null);
  const [updatingEvent, setUpdatingEvent] = useState(false);
  const [eventActionById, setEventActionById] = useState<Record<string, boolean>>({});
  const [activeCircle, setActiveCircle] = useState<string | null>(null);
  const [joinedCircles, setJoinedCircles] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(CIRCLE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
    } catch {
      return [];
    }
  });
  const [joinedCirclesHydrated, setJoinedCirclesHydrated] = useState(false);

  const loadJoinedCircles = useCallback(async () => {
    if (!user?.id) return;

    try {
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
      const stored = privacy.social_circles;
      if (Array.isArray(stored)) {
        setJoinedCircles(stored.filter((value): value is string => typeof value === "string"));
      }
    } catch (error) {
      console.warn("Could not load joined circles from profile:", error);
    } finally {
      setJoinedCirclesHydrated(true);
    }
  }, [user?.id]);

  // Persist whenever it changes
  useEffect(() => {
    try {
      if (expandedPostId) sessionStorage.setItem(EXPANDED_KEY, expandedPostId);
      else sessionStorage.removeItem(EXPANDED_KEY);
    } catch {
      // ignore
    }
  }, [expandedPostId]);

  useEffect(() => {
    expandedPostIdRef.current = expandedPostId;
  }, [expandedPostId]);

  useEffect(() => {
    highlightPostIdRef.current = highlightPostId;
  }, [highlightPostId]);

  const loadFeed = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // 1) Load posts
      let postRows: any[] | null = null;

      const withMetadata = await supabase
        .from("posts")
        .select("id, author_id, title, body, circle_name, created_at, updated_at, edited_at, collapsed_by_author")
        .order("created_at", { ascending: false })
        .limit(30);

      let postsError = withMetadata.error;
      postRows = withMetadata.data ?? [];

      if (postsError && isMissingPostMetadataColumnError(postsError)) {
        const fallback = await supabase
          .from("posts")
          .select("id, author_id, title, body, circle_name, created_at")
          .order("created_at", { ascending: false })
          .limit(30);

        postsError = fallback.error;
        postRows = (fallback.data ?? []).map((row: any) => ({
          ...row,
          updated_at: null,
          edited_at: null,
          collapsed_by_author: false,
        }));
      }

      if (postsError) throw postsError;

      const basePosts = (postRows ?? []) as PostRow[];
      const postIds = basePosts.map((p) => p.id);
      const authorIds = Array.from(new Set(basePosts.map((p) => p.author_id)));

      // 2) Load author names from profiles
      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", authorIds);

      if (profilesError) {
        // Don’t block feed if names fail; fallback below
        console.warn("profiles lookup failed:", profilesError.message);
      }

      const nameById = new Map<string, string>();
      (profileRows ?? []).forEach((r: any) => {
        nameById.set(r.id, r.full_name || r.username || "Member");
      });

      // 3) Likes count per post
      const { data: likeRows, error: likesError } = await supabase
        .from("post_likes")
        .select("post_id, user_id")
        .in("post_id", postIds);

      if (likesError) throw likesError;

      const likeCountByPost = new Map<string, number>();
      const likedByMeSet = new Set<string>();

      (likeRows ?? []).forEach((r: any) => {
        likeCountByPost.set(r.post_id, (likeCountByPost.get(r.post_id) ?? 0) + 1);
        if (r.user_id === user.id) likedByMeSet.add(r.post_id);
      });

      // 4) Load comments + replies for loaded posts
      const commentCountByPost = new Map<string, number>();
      const nextCommentsByPost: Record<string, HydratedComment[]> = {};
      const nextRepliesByParentId: Record<string, HydratedComment[]> = {};

      if (postIds.length > 0) {
        const { data: rawComments, error: commentsListError } = await supabase
          .from("post_comments")
          .select("id, post_id, user_id, body, created_at, parent_comment_id")
          .in("post_id", postIds)
          .order("created_at", { ascending: true });

        if (commentsListError) throw commentsListError;

        const comments = (rawComments ?? []) as CommentRow[];
        const commenterIds = Array.from(new Set(comments.map((c) => c.user_id)));

        let commenterProfiles: any[] = [];
        if (commenterIds.length > 0) {
          const { data, error: commenterProfilesError } = await supabase
            .from("profiles")
            .select("id, full_name, username")
            .in("id", commenterIds);

          if (commenterProfilesError) {
            console.warn(
              "commenter profiles lookup failed:",
              commenterProfilesError.message
            );
          } else {
            commenterProfiles = data ?? [];
          }
        }

        const commenterNameById = new Map<string, string>();
        commenterProfiles.forEach((r: any) => {
          commenterNameById.set(r.id, r.full_name || r.username || "Member");
        });

        comments.forEach((c) => {
          const hydrated: HydratedComment = {
            ...c,
            authorName:
              c.user_id === user.id
                ? "You"
                : commenterNameById.get(c.user_id) || "Member",
          };

          commentCountByPost.set(
            hydrated.post_id,
            (commentCountByPost.get(hydrated.post_id) ?? 0) + 1
          );

          if (hydrated.parent_comment_id) {
            const key = hydrated.parent_comment_id;
            nextRepliesByParentId[key] = [
              ...(nextRepliesByParentId[key] ?? []),
              hydrated,
            ];
          } else {
            const key = hydrated.post_id;
            nextCommentsByPost[key] = [
              ...(nextCommentsByPost[key] ?? []),
              hydrated,
            ];
          }
        });

        Object.values(nextCommentsByPost).forEach((arr) =>
          arr.sort(
            (a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        );
        Object.values(nextRepliesByParentId).forEach((arr) =>
          arr.sort(
            (a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        );
      }

      setCommentsByPost(nextCommentsByPost);
      setRepliesByParentId(nextRepliesByParentId);

      const hydrated: FeedPost[] = basePosts.map((p) => ({
        ...p,
        collapsed_by_author: !!p.collapsed_by_author,
        authorName:
          p.author_id === user.id
            ? "You"
            : nameById.get(p.author_id) || "Member",
        likeCount: likeCountByPost.get(p.id) ?? 0,
        commentCount: commentCountByPost.get(p.id) ?? 0,
        likedByMe: likedByMeSet.has(p.id),
      }));

      setPosts(hydrated);

      // If user is currently viewing comments, keep them in sync
      if (expandedPostIdRef.current) {
        await loadCommentsRef.current(expandedPostIdRef.current);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const loadEvents = useCallback(async () => {
    if (!user) {
      setEvents([]);
      setEventsLoading(false);
      setEventsError(null);
      return;
    }

    setEventsLoading(true);
    setEventsError(null);

    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("calendar_events")
        .select("id, user_id, title, description, location, circle_name, visibility, starts_at, ends_at, source, sync_state")
        .eq("source", "local")
        .gte("ends_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(100);

      if (error) throw error;

      const eventRows = ((data ?? []) as CalendarEventRow[]).filter((event) => event.visibility !== "private");
      const ownerIds = Array.from(new Set(eventRows.map((event) => event.user_id)));
      const eventIds = eventRows.map((event) => event.id);

      let profileRows: Array<{ id: string; full_name: string | null; username: string | null }> = [];
      if (ownerIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, username")
          .in("id", ownerIds);

        if (profilesError) {
          console.warn("Could not hydrate event owner names:", profilesError.message);
        } else {
          profileRows = (profilesData ?? []) as Array<{
            id: string;
            full_name: string | null;
            username: string | null;
          }>;
        }
      }

      const ownerNameById = new Map<string, string>();
      profileRows.forEach((profile) => {
        ownerNameById.set(profile.id, profile.full_name || profile.username || "Member");
      });

      let requestedEventIds = new Set<string>();
      if (eventIds.length > 0) {
        const { data: myRequests, error: myRequestsError } = await supabase
          .from("calendar_event_info_requests")
          .select("event_id")
          .eq("requester_id", user.id)
          .in("event_id", eventIds);

        if (myRequestsError) {
          console.warn("Could not load info request state:", myRequestsError.message);
        } else {
          requestedEventIds = new Set(
            ((myRequests ?? []) as Array<{ event_id: string }>).map((request) => request.event_id)
          );
        }
      }

      let requestCountByEvent = new Map<string, number>();
      let latestRequestMessageByEvent = new Map<string, string | null>();
      const ownerEventIds = eventRows.filter((event) => event.user_id === user.id).map((event) => event.id);
      if (ownerEventIds.length > 0) {
        const { data: ownerRequests, error: ownerRequestsError } = await supabase
          .from("calendar_event_info_requests")
          .select("event_id, message, created_at")
          .eq("owner_id", user.id)
          .in("event_id", ownerEventIds)
          .order("created_at", { ascending: false });

        if (ownerRequestsError) {
          console.warn("Could not load owner request counts:", ownerRequestsError.message);
        } else {
          requestCountByEvent = (ownerRequests ?? []).reduce((map, row: any) => {
            const current = map.get(row.event_id) ?? 0;
            map.set(row.event_id, current + 1);
            return map;
          }, new Map<string, number>());

          latestRequestMessageByEvent = (ownerRequests ?? []).reduce((map, row: any) => {
            if (!map.has(row.event_id)) {
              map.set(row.event_id, typeof row.message === "string" ? row.message : null);
            }
            return map;
          }, new Map<string, string | null>());
        }
      }

      const mapped = eventRows.map((event) => {
        const tags = [
          getEventAudienceLabel(event),
          event.source === "local"
            ? "Community"
            : event.source === "google"
              ? "Google"
              : "Outlook",
        ];

        if (event.sync_state === "pending") tags.push("Syncing");
        if (event.sync_state === "error") tags.push("Sync Error");

        return {
          id: event.id,
          ownerId: event.user_id,
          startsAt: event.starts_at,
          endsAt: event.ends_at,
          source: event.source,
          visibility: event.visibility,
          title: event.title,
          description: event.description || "No description provided.",
          date: formatEventDate(event.starts_at),
          time: formatEventTimeRange(event.starts_at, event.ends_at),
          location: event.location || "Location TBD",
          attendees: 1,
          maxAttendees: 10,
          tags,
          organizer: event.user_id === user.id ? "You" : ownerNameById.get(event.user_id) || "Member",
          isAttending: event.user_id === user.id,
          isOwnedByMe: event.user_id === user.id,
          circleName: event.circle_name ?? null,
          requestedByMe: requestedEventIds.has(event.id),
          infoRequestCount: requestCountByEvent.get(event.id) ?? 0,
          latestInfoRequestMessage: latestRequestMessageByEvent.get(event.id) ?? null,
        } as FeedEvent;
      });

      setEvents(mapped);
    } catch (e: any) {
      console.error(e);
        setEventsError(e?.message || "Failed to load events");
    } finally {
      setEventsLoading(false);
    }
  }, [user?.id]);

  const loadComments = async (postId: string) => {
    if (!user) return;

    setCommentsLoadingByPost((prev) => ({ ...prev, [postId]: true }));
    setCommentErrorByPost((prev) => ({ ...prev, [postId]: null }));

    try {
      const { data: rows, error } = await supabase
        .from("post_comments")
        .select("id, post_id, user_id, body, created_at, parent_comment_id")
        .eq("post_id", postId)
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) throw error;

      const base = (rows ?? []) as CommentRow[];

      const authorIds = Array.from(new Set(base.map((c) => c.user_id)));

      // Pull names from profiles (best effort)
      let profileRows: any[] = [];
      if (authorIds.length > 0) {
        const { data, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, username")
          .in("id", authorIds);

        if (profilesError) {
          console.warn("comment profiles lookup failed:", profilesError.message);
        } else {
          profileRows = data ?? [];
        }
      }

      const nameById = new Map<string, string>();
      (profileRows ?? []).forEach((r: any) => {
        nameById.set(r.id, r.full_name || r.username || "Member");
      });

      const hydratedRows: HydratedComment[] = base.map((c) => ({
        ...c,
        authorName: c.user_id === user.id ? "You" : nameById.get(c.user_id) || "Member",
      }));

      const topLevel = hydratedRows.filter((c) => !c.parent_comment_id);
      const repliesByParent = new Map<string, HydratedComment[]>();

      hydratedRows.forEach((c) => {
        if (!c.parent_comment_id) return;
        const arr = repliesByParent.get(c.parent_comment_id) ?? [];
        arr.push(c);
        repliesByParent.set(c.parent_comment_id, arr);
      });

      repliesByParent.forEach((arr) =>
        arr.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      );

      const parentIdsForThisPost = new Set<string>();
      hydratedRows.forEach((c) => {
        if (!c.parent_comment_id) parentIdsForThisPost.add(c.id);
      });

      setCommentsByPost((prev) => ({ ...prev, [postId]: topLevel }));
      setRepliesByParentId((prev) => {
        const next = { ...prev };

        // clear existing reply buckets for this post’s parent comments
        parentIdsForThisPost.forEach((parentId) => {
          delete next[parentId];
        });

        // set fresh reply buckets
        return { ...next, ...Object.fromEntries(repliesByParent) };
      });
    } catch (e: any) {
      console.error(e);
      setCommentErrorByPost((prev) => ({
        ...prev,
        [postId]: e?.message || "Failed to load comments",
      }));
    } finally {
      setCommentsLoadingByPost((prev) => ({ ...prev, [postId]: false }));
    }
  };

  useEffect(() => {
    loadFeedRef.current = loadFeed;
  }, [loadFeed]);

  useEffect(() => {
    loadCommentsRef.current = loadComments;
  }, [loadComments]);

  useEffect(() => {
    if (!user) return;
    if (!expandedPostId) return;

    // If we don't have comments cached (or if you want always-fresh), load them.
    if (!commentsByPost[expandedPostId]) {
      loadComments(expandedPostId);
    }
    // If you want it to always reload whenever expandedPostId changes, remove the if.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedPostId, user?.id]);

  useEffect(() => {
    if (!user) return;
    void loadFeedRef.current();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    void loadEvents();
  }, [loadEvents, user?.id]);

  useEffect(() => {
    try {
      localStorage.setItem(CIRCLE_STORAGE_KEY, JSON.stringify(joinedCircles));
    } catch {
      // ignore local persistence issues
    }
  }, [joinedCircles]);

  useEffect(() => {
    if (!user) return;
    void loadJoinedCircles();
  }, [loadJoinedCircles, user?.id]);

  useEffect(() => {
    if (!user?.id || !joinedCirclesHydrated) return;

    const persistJoinedCircles = async () => {
      try {
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
              social_circles: joinedCircles,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (updateError) throw updateError;
      } catch (error) {
        console.warn("Could not persist joined circles:", error);
      }
    };

    void persistJoinedCircles();
  }, [joinedCircles, joinedCirclesHydrated, user?.id]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const postId = params.get("post");
    const focusCommentId = params.get("focusComment");
    const t = (params.get("t") || "").toLowerCase();
    const commentsParam = params.get("comments");
    const shouldAutoExpand =
      commentsParam === "1" || t === "post_comment" || t === "comment_reply";

    if (!postId) return;
    if (focusCommentId) {
      focusCommentIdRef.current = focusCommentId;
    }

    const cleaned = new URL(window.location.href);
    cleaned.searchParams.delete("post");
    cleaned.searchParams.delete("t");
    cleaned.searchParams.delete("comments");
    cleaned.searchParams.delete("focusComment");
    window.history.replaceState({}, "", cleaned.toString());

    // Save so we can use it after posts load
    highlightPostIdRef.current = postId;

    // If post is already in state, highlight immediately
    const exists = posts.some((p) => p.id === postId);
    if (exists) {
      setHighlightPostId(postId);
      highlightPostIdRef.current = null;

      if (shouldAutoExpand) {
        setExpandedPostId(postId);
        if (!commentsByPost[postId]) {
          void loadComments(postId);
        }
      }

      // scroll + clear highlight
      requestAnimationFrame(() => {
        document.getElementById(`post-${postId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });

      window.setTimeout(() => setHighlightPostId(null), 2200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  useEffect(() => {
    const postId = highlightPostIdRef.current;
    if (!postId) return;
    const params = new URLSearchParams(location.search);
    const t = (params.get("t") || "").toLowerCase();
    const commentsParam = params.get("comments");
    const shouldAutoExpand =
      commentsParam === "1" || t === "post_comment" || t === "comment_reply";

    const exists = posts.some((p) => p.id === postId);
    if (!exists) return;

    const run = async () => {
      setHighlightPostId(postId);

      if (shouldAutoExpand) {
        setExpandedPostId(postId);

        if (!commentsByPost[postId]) {
          await loadComments(postId);
        }
      }

      requestAnimationFrame(() => {
        document.getElementById(`post-${postId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });

      const commentId = focusCommentIdRef.current;
      if (commentId) {
        requestAnimationFrame(() => {
          document.getElementById(`comment-${commentId}`)?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        });

        setHighlightCommentId(commentId);

        window.setTimeout(() => {
          setHighlightCommentId(null);
        }, 2200);

        focusCommentIdRef.current = null;
      }

      window.setTimeout(() => setHighlightPostId(null), 2200);

      // only once
      highlightPostIdRef.current = null;
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts]);

  useEffect(() => {
    if (!user) return;

    const params = new URLSearchParams(location.search);
    const postId = params.get("post");
    const t = (params.get("t") || "").toLowerCase();
    const shouldAutoExpand =
      t === "post_comment" || t === "comment_reply";
    const commentId = params.get("comment");

    if (!postId) return;

    // if posts not loaded yet, load feed first
    const run = async () => {
      if (!posts.some((p) => p.id === postId)) {
        await loadFeed();
      }

      // highlight + scroll
      setHighlightPostId(postId);
      window.setTimeout(() => setHighlightPostId(null), 1200);

      // open comments only for comment/reply notifications
      if (shouldAutoExpand) {
        setExpandedPostId(postId);
        if (!commentsByPost[postId]) {
          await loadComments(postId);
        } else if (commentId) {
          // if already loaded, refresh once to be safe (optional)
          await loadComments(postId);
        }
      }

      // If we were sent a specific comment, scroll to it and open reply box (if it's a top-level comment)
      if (commentId && shouldAutoExpand) {
        // highlight post briefly
        setHighlightPostId(postId);
        window.setTimeout(() => setHighlightPostId(null), 1200);
        setHighlightCommentId(commentId);
        window.setTimeout(() => setHighlightCommentId(null), 1200);

        // wait a tick for comment DOM to render, then scroll
        window.setTimeout(() => {
          const el = document.getElementById(`comment-${commentId}`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);

        // optionally auto-open reply box for that comment (only for top-level comments)
        setReplyToByPost((prev) => ({ ...prev, [postId]: commentId }));
      }

      // scroll into view (after DOM paints)
      window.setTimeout(() => {
        const el = document.getElementById(`post-${postId}`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, location.search]);

  useEffect(() => {
    if (!user) return;
    const myId = user.id;
    let reloadTimer: number | null = null;

    const scheduleReload = () => {
      if (reloadTimer) return;
      reloadTimer = window.setTimeout(async () => {
        reloadTimer = null;
        await loadFeedRef.current();
      }, 400);
    };

    const channel = supabase
      .channel("vv-social-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => {
          scheduleReload();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_likes" },
        (payload) => {
          const event = payload.eventType;
          const rowNew: any = (payload as any).new;
          const rowOld: any = (payload as any).old;

          const postId = (rowNew?.post_id ?? rowOld?.post_id) as string | undefined;
          const userId = (rowNew?.user_id ?? rowOld?.user_id) as string | undefined;
          if (!postId) return;

          setPosts((prev) =>
            prev.map((p) => {
              if (p.id !== postId) return p;

              const delta = event === "INSERT" ? 1 : event === "DELETE" ? -1 : 0;

              const likedByMe =
                myId && userId === myId
                  ? event === "INSERT"
                    ? true
                    : event === "DELETE"
                      ? false
                      : p.likedByMe
                  : p.likedByMe;

              return {
                ...p,
                likeCount: Math.max(0, p.likeCount + delta),
                likedByMe,
              };
            })
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comments" },
        async (payload) => {
          const event = payload.eventType;
          const rowNew: any = (payload as any).new;
          const rowOld: any = (payload as any).old;

          const postId = (rowNew?.post_id ?? rowOld?.post_id) as string | undefined;
          if (!postId) return;

          const delta = event === "INSERT" ? 1 : event === "DELETE" ? -1 : 0;

          // 1) Keep counter in sync
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId
                ? { ...p, commentCount: Math.max(0, (p.commentCount ?? 0) + delta) }
                : p
            )
          );

          // 2) If that post’s comments are open, refresh the thread
          if (expandedPostIdRef.current === postId) {
            await loadCommentsRef.current(postId);
          }
        }
      )
      .subscribe((status) => {
        console.log("vv-social-feed status:", status);
      });

    return () => {
      if (reloadTimer) window.clearTimeout(reloadTimer);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`vv-social-events-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calendar_events",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadEvents, user?.id]);

  const handleCreatePost = async () => {
    if (!user) return;

    const body = newPost.trim();
    if (!body) return;

    const title = derivePostTitle(body);

    setPosting(true);
    setError(null);

    const tempId = `temp_${Date.now()}`;
    const newPostId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `post_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const optimisticPost: FeedPost = {
      id: tempId,
      author_id: user.id,
      title,
      body,
      circle_name: activeCircle,
      created_at: new Date().toISOString(),
      updated_at: null,
      edited_at: null,
      collapsed_by_author: false,
      authorName: "You",
      likeCount: 0,
      commentCount: 0,
      likedByMe: false,
      _optimistic: true,
    };

    // Show instantly
    setPosts((prev) => [optimisticPost, ...prev]);
    setNewPost("");

    try {
      const { data, error: insertError } = await supabase
        .from("posts")
        .insert({
          id: newPostId,
          author_id: user.id,
          title,
          body,
          ...(activeCircle ? { circle_name: activeCircle } : {}),
        })
        .select("id, author_id, title, body, circle_name, created_at, updated_at, edited_at, collapsed_by_author")
        .single();

      let savedRow: any = data;
      let savedRowError: any = insertError;

      if (savedRowError && isMissingPostMetadataColumnError(savedRowError)) {
        const fallbackLookup = await supabase
          .from("posts")
          .select("id, author_id, title, body, circle_name, created_at")
          .eq("id", newPostId)
          .maybeSingle();

        if (fallbackLookup.error) {
          savedRowError = fallbackLookup.error;
          savedRow = null;
        } else if (fallbackLookup.data) {
          savedRowError = null;
          savedRow = {
            ...fallbackLookup.data,
            updated_at: null,
            edited_at: null,
            collapsed_by_author: false,
          };
        }
      }

      if (savedRowError) throw savedRowError;
      if (!savedRow) throw new Error("Post insert returned no data.");

      // Replace the optimistic post with the real row
      setPosts((prev) =>
        prev.map((p) =>
          p.id === tempId
            ? {
                ...p,
                ...savedRow,
                title: savedRow.title ?? title, // keep a string fallback
                _optimistic: false,
              }
            : p
        )
      );

      // Refresh “truth” (names/likes/comments)
      await loadFeed();
    } catch (e: any) {
      console.error(e);

      // Remove optimistic post
      setPosts((prev) => prev.filter((p) => p.id !== tempId));

      setError(e?.message || "Could not post. Try again.");
      setNewPost(body); // restore text
    } finally {
      setPosting(false);
    }
  };

  const startEditPost = (post: FeedPost) => {
    setError(null);
    setEditingPostId(post.id);
    setEditingPostBody(post.body);
    setExpandedBodyByPostId((prev) => ({ ...prev, [post.id]: true }));
  };

  const cancelEditPost = () => {
    setEditingPostId(null);
    setEditingPostBody("");
  };

  const saveEditedPost = async (postId: string) => {
    if (!user) return;

    const body = editingPostBody.trim();
    if (!body) {
      setError("Post text cannot be empty.");
      return;
    }

    const title = derivePostTitle(body);
    const editedAt = new Date().toISOString();

    setPostActionLoadingById((prev) => ({ ...prev, [postId]: true }));
    setError(null);

    // optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              body,
              title,
              edited_at: editedAt,
              updated_at: editedAt,
            }
          : p
      )
    );

    try {
      const { error: updateError } = await supabase
        .from("posts")
        .update({ body, title })
        .eq("id", postId)
        .eq("author_id", user.id);

      if (updateError) throw updateError;

      setEditingPostId(null);
      setEditingPostBody("");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Could not save post changes.");
      await loadFeed();
    } finally {
      setPostActionLoadingById((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const toggleManualPostCollapse = async (postId: string, nextCollapsed: boolean) => {
    if (!user) return;

    setPostActionLoadingById((prev) => ({ ...prev, [postId]: true }));
    setError(null);

    // optimistic
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, collapsed_by_author: nextCollapsed } : p
      )
    );
    setExpandedBodyByPostId((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    if (nextCollapsed && expandedPostIdRef.current === postId) {
      setExpandedPostId(null);
    }

    try {
      const { error: updateError } = await supabase
        .from("posts")
        .update({ collapsed_by_author: nextCollapsed })
        .eq("id", postId)
        .eq("author_id", user.id);

      if (updateError) throw updateError;
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Could not update post collapse.");
      await loadFeed();
    } finally {
      setPostActionLoadingById((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const deletePost = async (postId: string) => {
    if (!user) return;
    if (!window.confirm(t("deletePostConfirm"))) return;

    setPostActionLoadingById((prev) => ({ ...prev, [postId]: true }));
    setError(null);

    // optimistic remove
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setCommentsByPost((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setCommentInputs((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setCommentErrorByPost((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setCommentsLoadingByPost((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setReplyToByPost((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    if (expandedPostId === postId) {
      setExpandedPostId(null);
    }
    if (editingPostId === postId) {
      cancelEditPost();
    }

    try {
      const { error: deleteError } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("author_id", user.id);

      if (deleteError) throw deleteError;
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Could not delete post.");
      await loadFeed();
    } finally {
      setPostActionLoadingById((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const sendComment = async (postId: string) => {
    if (!user) return;

    const body = (commentInputs[postId] || "").trim();
    if (!body) return;

    setCommentErrorByPost((prev) => ({ ...prev, [postId]: null }));
    setCommenting((prev) => ({ ...prev, [postId]: true }));

    // optimistic comment
    const tempId = `temp_c_${Date.now()}`;
    const optimistic: HydratedComment = {
      id: tempId,
      post_id: postId,
      user_id: user.id,
      body,
      created_at: new Date().toISOString(),
      parent_comment_id: null,
      authorName: "You",
    };

    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), optimistic],
    }));

    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));

    // optimistic commentCount bump on the post card
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, commentCount: (p.commentCount ?? 0) + 1 } : p
      )
    );

    try {
      const { data, error } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: user.id,
          body,
        })
        .select("id, post_id, user_id, body, created_at")
        .single();

      if (error) throw error;
      if (!data) throw new Error("Comment insert returned no data.");

      // replace optimistic with real row
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).map((c) =>
          c.id === tempId
            ? {
                ...c,
                ...data,
                parent_comment_id: null,
                authorName: "You",
              }
            : c
        ),
      }));

      await loadComments(postId);
    } catch (e: any) {
      console.error(e);

      // remove optimistic comment
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((c) => c.id !== tempId),
      }));

      // revert count
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, commentCount: Math.max(0, (p.commentCount ?? 0) - 1) } : p
        )
      );

      setCommentErrorByPost((prev) => ({
        ...prev,
        [postId]: e?.message || "Could not comment. Try again.",
      }));

      // restore draft so they don’t lose it
      setCommentInputs((prev) => ({ ...prev, [postId]: body }));
    } finally {
      setCommenting((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const sendReply = async (postId: string, parentCommentId: string) => {
    if (!user) return;

    const key = `${postId}:${parentCommentId}`;
    const body = (replyInputs[key] || "").trim();
    if (!body) return;

    setCommentErrorByPost((prev) => ({ ...prev, [postId]: null }));
    setCommenting((prev) => ({ ...prev, [postId]: true }));

    const tempId = `temp_r_${Date.now()}`;
    const optimisticReply: HydratedComment = {
      id: tempId,
      post_id: postId,
      user_id: user.id,
      body,
      created_at: new Date().toISOString(),
      parent_comment_id: parentCommentId,
      authorName: "You",
      _optimistic: true,
    };

    setRepliesByParentId((prev) => ({
      ...prev,
      [parentCommentId]: [...(prev[parentCommentId] || []), optimisticReply],
    }));

    setReplyInputs((prev) => ({ ...prev, [key]: "" }));

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, commentCount: (p.commentCount ?? 0) + 1 } : p
      )
    );

    try {
      const { data, error } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: user.id,
          body,
          parent_comment_id: parentCommentId,
        })
        .select("id, post_id, user_id, body, created_at, parent_comment_id")
        .single();

      if (error) throw error;
      if (!data) throw new Error("Reply insert returned no data.");

      const savedReply: HydratedComment = {
        ...data,
        parent_comment_id: parentCommentId,
        authorName: "You",
      };

      setRepliesByParentId((prev) => ({
        ...prev,
        [parentCommentId]: (prev[parentCommentId] || []).map((reply) =>
          reply.id === tempId ? savedReply : reply
        ),
      }));

      setReplyToByPost((prev) => ({ ...prev, [postId]: null }));
      await loadComments(postId);
    } catch (e: any) {
      console.error(e);

      setRepliesByParentId((prev) => ({
        ...prev,
        [parentCommentId]: (prev[parentCommentId] || []).filter(
          (reply) => reply.id !== tempId
        ),
      }));

      setCommentErrorByPost((prev) => ({
        ...prev,
        [postId]: e?.message || "Could not reply. Try again.",
      }));

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, commentCount: Math.max(0, (p.commentCount ?? 0) - 1) } : p
        )
      );

      setReplyInputs((prev) => ({ ...prev, [key]: body }));
    } finally {
      setCommenting((prev) => ({ ...prev, [postId]: false }));
    }
  };


  const toggleLike = async (postId: string, likedByMe: boolean) => {
    if (!user) {
      setError("Please sign in to react to posts.");
      return;
    }

    setError(null);
    const delta = likedByMe ? -1 : 1;

    // optimistic UI
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              likedByMe: !likedByMe,
              likeCount: Math.max(0, p.likeCount + delta),
            }
          : p
      )
    );

    try {
      if (likedByMe) {
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("post_likes").insert({
          post_id: postId,
        });

        // Unique violation means we already liked it; treat as success.
        if (error && error.code !== "23505") throw error;
      }
    } catch (e: any) {
      console.error("toggleLike failed:", e);

      // revert optimistic update
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                likedByMe,
                likeCount: Math.max(0, p.likeCount - delta),
              }
            : p
        )
      );

      setError(e?.message || "Could not update heart. Please try again.");
    }
  };

  const handleCreateEvent = async () => {
    if (!user) return;

    const title = newEvent.title.trim();
    if (!title || !newEvent.date || !newEvent.time) {
      setEventsError("Title, date, and time are required.");
      return;
    }

    const startsAt = new Date(`${newEvent.date}T${newEvent.time}`);
    if (Number.isNaN(startsAt.getTime())) {
      setEventsError("Invalid date or time.");
      return;
    }

    const endsAt = new Date(startsAt);
    endsAt.setHours(endsAt.getHours() + 1);

    setCreatingEvent(true);
    setEventsError(null);
    try {
      const { error } = await supabase.from("calendar_events").insert({
        user_id: user.id,
        title,
        description: newEvent.description.trim() || null,
        location: newEvent.location.trim() || null,
        visibility: activeCircle ? "circle" : "shared",
        ...(activeCircle ? { circle_name: activeCircle } : {}),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        source: "local",
        sync_state: "pending",
      });

      if (error) throw error;

      setNewEvent({
        title: "",
        description: "",
        date: "",
        time: "",
        location: "",
      });
      setShowCreateEvent(false);
      await loadEvents();
    } catch (e: any) {
      console.error(e);
      setEventsError(e?.message || "Could not create event.");
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleJoinEvent = (eventId: string) => {
    let joinedEventTitle = "";

    setEvents((prev) =>
      prev.map((event) => {
        if (event.id !== eventId) return event;
        if (event.isAttending) return event;

        joinedEventTitle = event.title;
        return {
          ...event,
          isAttending: true,
          attendees: Math.min(event.maxAttendees, event.attendees + 1),
        };
      })
    );

    if (joinedEventTitle) {
      toast({
        title: "RSVP confirmed",
        description: `Invite a friend to attend with you for ${joinedEventTitle}.`,
      });
    }
  };

  const applyEventTemplate = (template: (typeof EVENT_TEMPLATES)[number]) => {
    setNewEvent((prev) => ({
      ...prev,
      title: template.title,
      description: template.description,
    }));
  };

  const handleInviteEvent = async (eventId: string) => {
    const event = events.find((item) => item.id === eventId);
    if (!event) return;

    const eventUrl = `${window.location.origin}/social?event=${event.id}`;
    const message = `Join me for ${event.title} on ${event.date} at ${event.time}. Invite friends outside the app and bring your people. ${eventUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: message,
          url: eventUrl,
        });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(message);
      toast({
        title: "Invite copied",
        description: "Share it with friends outside the app.",
      });
    } catch (error) {
      toast({
        title: "Could not copy invite",
        description: "Try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const beginEditEvent = (eventId: string) => {
    if (!user) return;
    const event = events.find((item) => item.id === eventId);
    if (!event || event.ownerId !== user.id) return;
    if (event.source !== "local") {
      toast({
        variant: "destructive",
        title: "This event cannot be edited here",
        description: "Only local Violets & Vibes events can be edited.",
      });
      return;
    }

    setEditingEventId(event.id);
    setEditingEvent({
      title: event.title,
      description: event.description === "No description provided." ? "" : event.description,
      location: event.location === "Location TBD" ? "" : event.location,
      visibility: event.visibility,
      circleName: event.circleName || "",
      startsAt: toDateTimeLocalValue(event.startsAt),
      endsAt: toDateTimeLocalValue(event.endsAt),
    });
    setEventsError(null);
  };

  const cancelEditEvent = () => {
    setEditingEventId(null);
    setEditingEvent(null);
    setUpdatingEvent(false);
  };

  const saveEditedEvent = async () => {
    if (!user || !editingEventId || !editingEvent) return;

    const title = editingEvent.title.trim();
    if (!title) {
      setEventsError("Event title is required.");
      return;
    }

    const startsAt = new Date(editingEvent.startsAt);
    const endsAt = new Date(editingEvent.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      setEventsError("Invalid start or end date.");
      return;
    }
    if (endsAt <= startsAt) {
      setEventsError("End time must be after start time.");
      return;
    }
    if (editingEvent.visibility === "circle" && !editingEvent.circleName) {
      setEventsError("Choose a circle for circle-only events.");
      return;
    }

    setUpdatingEvent(true);
    setEventsError(null);
    try {
      const { error } = await supabase
        .from("calendar_events")
        .update({
          title,
          description: editingEvent.description.trim() || null,
          location: editingEvent.location.trim() || null,
          visibility: editingEvent.visibility,
          circle_name: editingEvent.visibility === "circle" ? editingEvent.circleName || null : null,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingEventId)
        .eq("user_id", user.id)
        .eq("source", "local");

      if (error) throw error;

      await loadEvents();
      cancelEditEvent();
      toast({
        title: "Event updated",
        description: "Your changes are now live in Events and Social.",
      });
    } catch (error: any) {
      console.error(error);
      setEventsError(error?.message || "Could not update event.");
    } finally {
      setUpdatingEvent(false);
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!user) return;
    const event = events.find((item) => item.id === eventId);
    if (!event || event.ownerId !== user.id) return;

    const confirmed = window.confirm(
      `Delete "${event.title}"? This will remove it from Events and Social feeds.`
    );
    if (!confirmed) return;

    setEventActionById((prev) => ({ ...prev, [eventId]: true }));
    setEventsError(null);

    try {
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", eventId)
        .eq("user_id", user.id)
        .eq("source", "local");

      if (error) throw error;

      setEvents((prev) => prev.filter((item) => item.id !== eventId));
      if (editingEventId === eventId) {
        cancelEditEvent();
      }

      toast({
        title: "Event deleted",
        description: "The event was removed successfully.",
      });
    } catch (error: any) {
      console.error(error);
      setEventsError(error?.message || "Could not delete event.");
    } finally {
      setEventActionById((prev) => {
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
    }
  };

  const requestEventInfo = async (eventId: string) => {
    if (!user) return;
    const event = events.find((item) => item.id === eventId);
    if (!event || event.ownerId === user.id) return;
    if (event.requestedByMe) {
      toast({
        title: "Already requested",
        description: "You already asked the organizer for more details.",
      });
      return;
    }

    const message = window.prompt(
      "Optional note for the organizer (for example: accessibility, parking, age range):",
      ""
    );
    if (message === null) return;

    setEventActionById((prev) => ({ ...prev, [eventId]: true }));
    setEventsError(null);

    try {
      const payload: Omit<EventInfoRequestRow, "id"> = {
        event_id: event.id,
        requester_id: user.id,
        owner_id: event.ownerId,
        message: message.trim() || null,
      };

      const { error } = await supabase.from("calendar_event_info_requests").insert(payload);
      if (error && error.code !== "23505") throw error;

      setEvents((prev) =>
        prev.map((item) => (item.id === eventId ? { ...item, requestedByMe: true } : item))
      );

      toast({
        title: "Request sent",
        description: "The event organizer can now review your request for more details.",
      });
    } catch (error: any) {
      console.error(error);
      setEventsError(error?.message || "Could not send info request.");
    } finally {
      setEventActionById((prev) => {
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
    }
  };

  const handleToggleJoinCircle = (circleName: string) => {
    setJoinedCircles((prev) => {
      const next = prev.includes(circleName)
        ? prev.filter((name) => name !== circleName)
        : [...prev, circleName];
      return next;
    });
    setActiveCircle(circleName);
  };

  const filteredPosts = posts.filter((post) => {
    if (!activeCircle) return true;
    return post.circle_name === activeCircle;
  });

  const filteredEvents = events.filter((event) => {
    if (!activeCircle) return true;
    return event.circleName === activeCircle;
  });

  return (
    <div className="p-4 w-full">
      <div className="max-w-7xl mx-auto grid social-feed-columns gap-3 sm:gap-4 items-start">
        <section className="space-y-4">
          <div className="px-1">
            <h2 className="wedding-heading text-2xl text-white">Community Feed</h2>
          </div>

          <Card className="bg-violet-950/75 border-violet-400/35 text-white backdrop-blur-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-white/90 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-pink-200 shrink-0" />
                Conversations here are expected to remain respectful and aligned with community standards.
              </div>
            </CardContent>
          </Card>

          <CommunityCirclesCard
            activeCircle={activeCircle}
            joinedCircleNames={joinedCircles}
            onSelectCircle={setActiveCircle}
            onToggleJoin={handleToggleJoinCircle}
          />

          {/* Create Post */}
          <Card className="bg-violet-950/80 border-violet-400/40 text-white backdrop-blur-sm">
            <CardContent className="p-4">
              {activeCircle ? (
                <div className="mb-3 inline-flex items-center rounded-full border border-pink-300/25 bg-pink-400/10 px-3 py-1 text-xs font-medium text-pink-100">
                  {t("postingInto", { circle: activeCircle })}
                </div>
              ) : null}
              <Textarea
                placeholder={t("shareSomethingWithTheCommunity")}
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                className="mb-3 bg-violet-900/70 border-violet-500/50 text-white placeholder:text-white/70 focus-visible:border-violet-300"
                maxLength={1000}
              />
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-white/80">{newPost.trim().length}/1000</div>
                <Button
                  onClick={handleCreatePost}
                  disabled={!newPost.trim() || posting}
                  className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                >
                  {posting ? t("posting") : t("sharePost")}
                </Button>
              </div>
              {error && <div className="text-sm text-red-300 mt-2">{error}</div>}
            </CardContent>
          </Card>

          {/* Feed */}
          {loading ? (
            <div className="text-white/80">{t("loadingFeed")}</div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-white/80">
              {activeCircle
                ? t("noPostsInCircleYet", { circle: activeCircle })
                : `${t("noPostsYet")} 💜`}
            </div>
          ) : (
            filteredPosts.map((post) => {
              const isOwnPost = post.author_id === user?.id;
              const isAutoCollapsed =
                Date.now() - new Date(post.created_at).getTime() >= POST_AUTO_COLLAPSE_MS;
              const isManuallyCollapsed = !!post.collapsed_by_author;
              const isCollapsed = isAutoCollapsed || isManuallyCollapsed;
              const isBodyExpanded = !!expandedBodyByPostId[post.id];
              const isEditingPost = editingPostId === post.id;
              const postActionLoading = !!postActionLoadingById[post.id];
              const isCollapsedCardView =
                isCollapsed && !isBodyExpanded && !isEditingPost;

              return (
                <Card
                  id={`post-${post.id}`}
                  key={post.id}
                  className={`bg-violet-950/75 border-violet-400/40 text-white backdrop-blur-sm transition-all ${
                    post._optimistic ? "opacity-70" : ""
                  } ${highlightPostId === post.id ? "ring-2 ring-pink-300 vv-pulse-highlight" : ""}`}
                >
                  <CardHeader className={isCollapsedCardView ? "p-3 pb-1" : "p-4 pb-2"}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center ${
                            isCollapsedCardView ? "w-8 h-8" : "w-10 h-10"
                          }`}
                        >
                          <span className="text-white font-semibold">{(post.authorName || "M")[0]}</span>
                        </div>
                        <div>
                          <p className={`${isCollapsedCardView ? "text-sm" : ""} font-semibold text-white`}>
                            {post.authorName}
                          </p>
                          <p className={`${isCollapsedCardView ? "text-xs" : "text-sm"} text-white/70`}>
                            {timeAgo(post.created_at)}
                          </p>
                          {post.edited_at && !isCollapsedCardView ? (
                            <p className="text-xs text-white/50">{t("editSaved")} {timeAgo(post.edited_at)}</p>
                          ) : null}
                        </div>
                      </div>

                      {post._optimistic && (
                        <span className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/15 text-white/80">
                          {t("postInFlight")}
                        </span>
                      )}
                    </div>
                    <div className="mt-3">
                      <span className="inline-flex rounded-full border border-pink-300/20 bg-pink-400/10 px-2 py-1 text-[11px] font-medium text-pink-100">
                        {post.circle_name ?? t("openCommunity")}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className={isCollapsedCardView ? "px-3 pb-3 pt-1" : "p-4 pt-0"}>
                    {isEditingPost ? (
                      <div className="mb-3 space-y-2">
                        <Textarea
                          value={editingPostBody}
                          onChange={(e) => setEditingPostBody(e.target.value)}
                          maxLength={1000}
                          className="bg-violet-900/70 border-violet-500/50 text-white placeholder:text-white/70"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-white/70">{editingPostBody.trim().length}/1000</div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => saveEditedPost(post.id)}
                              disabled={postActionLoading || !editingPostBody.trim()}
                            >
                              {postActionLoading ? t("saving") : t("save")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={cancelEditPost}
                              disabled={postActionLoading}
                            >
                              {t("cancel")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {!isCollapsedCardView ? (
                          <p className="text-white/90 mb-3 whitespace-pre-wrap">
                            {post.body}
                          </p>
                        ) : null}

                        {isCollapsed && (
                          <div className={`${isCollapsedCardView ? "mb-1" : "mb-3"} flex flex-wrap items-center gap-2`}>
                            {!isCollapsedCardView ? (
                              <span className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/15 text-white/75">
                                {isManuallyCollapsed
                                  ? t("collapsedByAuthor")
                                  : t("autoCollapsedAfter24h")}
                              </span>
                            ) : (
                              <span className="text-[11px] text-white/65">
                                {isManuallyCollapsed ? t("collapsed") : t("autoCollapsed")}
                              </span>
                            )}
                            <button
                              type="button"
                              className="text-xs text-pink-200 hover:text-pink-100 underline"
                              onClick={() =>
                                setExpandedBodyByPostId((prev) => ({
                                  ...prev,
                                  [post.id]: !prev[post.id],
                                }))
                              }
                            >
                              {isBodyExpanded ? t("collapseView") : t("showFullPost")}
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    <div className={`flex ${isCollapsedCardView ? "space-x-3 text-xs" : "space-x-4 text-sm"} text-white/80`}>
                      <button
                        disabled={post._optimistic || isEditingPost}
                        className={`hover:text-pink-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                          post.likedByMe ? "text-pink-300" : ""
                        }`}
                        onClick={() => toggleLike(post.id, post.likedByMe)}
                        type="button"
                      >
                        {post.likedByMe ? "💜" : "🤍"} {post.likeCount}
                      </button>

                      <button
                        className="hover:text-pink-300"
                        type="button"
                        onClick={() => {
                          if (isCollapsedCardView) {
                            setExpandedBodyByPostId((prev) => ({
                              ...prev,
                              [post.id]: true,
                            }));
                          }
                          const nextPostId = expandedPostId === post.id ? null : post.id;
                          setExpandedPostId(nextPostId);

                          if (nextPostId === post.id && !commentsByPost[post.id]) {
                            loadComments(post.id);
                          }
                        }}
                      >
                        💬 {post.commentCount}
                      </button>
                    </div>

                    {isOwnPost && !post._optimistic && !isEditingPost && (
                      <div className={`${isCollapsedCardView ? "mt-1 gap-2" : "mt-2 gap-3"} flex flex-wrap items-center text-xs`}>
                        <button
                          type="button"
                          className="text-white/80 hover:text-white disabled:opacity-50"
                          disabled={postActionLoading}
                          onClick={() => startEditPost(post)}
                        >
                          {t("edit")}
                        </button>
                        <button
                          type="button"
                          className="text-white/80 hover:text-white disabled:opacity-50"
                          disabled={postActionLoading}
                          onClick={() =>
                            toggleManualPostCollapse(post.id, !isManuallyCollapsed)
                          }
                        >
                          {isManuallyCollapsed ? t("uncollapse") : t("collapse")}
                        </button>
                        <button
                          type="button"
                          className="text-red-300 hover:text-red-200 disabled:opacity-50"
                          disabled={postActionLoading}
                          onClick={() => deletePost(post.id)}
                        >
                          {t("delete")}
                        </button>
                      </div>
                    )}

                    {expandedPostId === post.id && !isCollapsedCardView && (
                      <div className="mt-4 border-t border-white/20 pt-3 space-y-3">
                      {/* Existing Comments */}
                      {commentsLoadingByPost[post.id] ? (
                        <div className="text-sm text-white/60">{t("loadingComments")}</div>
                      ) : (commentsByPost[post.id] ?? []).length === 0 ? (
                        <div className="text-sm text-white/60">{t("noCommentsYet")}</div>
                      ) : (
                        commentsByPost[post.id].map((c) => {
                          const isReplying = replyToByPost[post.id] === c.id;

                          return (
                            <div
                              id={`comment-${c.id}`}
                              key={c.id}
                              className={`text-sm text-white/90 transition-colors ${
                                highlightCommentId === c.id ? "vv-focus-highlight" : ""
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <span className="font-semibold">{c.authorName || "Member"}</span>{" "}
                                  {c.body}
                                </div>

                                <button
                                  type="button"
                                  className="text-xs text-white/70 hover:text-pink-300 shrink-0"
                                  onClick={() => {
                                    console.log("Reply clicked", post.id, c.id);
                                    setReplyToByPost((prev) => {
                                      const next = {
                                        ...prev,
                                        [post.id]: prev[post.id] === c.id ? null : c.id,
                                      };
                                      console.log(
                                        "replyToByPost next:",
                                        next[post.id],
                                        "expected:",
                                        c.id
                                      );
                                      return next;
                                    });
                                  }}
                                >
                                  {t("reply")}
                                </button>
                              </div>

                              {(repliesByParentId[c.id] ?? []).map((r) => (
                                <div key={r.id} id={`comment-${r.id}`} className="ml-6 mt-2 text-sm text-white/85">
                                  <span className="font-semibold">{r.authorName || "Member"}</span>{" "}
                                  {r.body}
                                </div>
                              ))}

                              {isReplying && (
                                <div className="mt-2 ml-4 flex gap-2">
                                  <Input
                                    placeholder={t("replyToMember", { name: c.authorName || "Member" })}
                                    value={replyInputs[`${post.id}:${c.id}`] || ""}
                                    onChange={(e) =>
                                      setReplyInputs((prev) => ({
                                        ...prev,
                                        [`${post.id}:${c.id}`]: e.target.value,
                                      }))
                                    }
                                    className="bg-violet-900/50 border-violet-400/40 text-white"
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => sendReply(post.id, c.id)}
                                    disabled={
                                      commenting[post.id] ||
                                      !((replyInputs[`${post.id}:${c.id}`] || "").trim())
                                    }
                                  >
                                    {t("send")}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setReplyToByPost((prev) => ({ ...prev, [post.id]: null }))
                                    }
                                  >
                                    {t("cancel")}
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}

                      {/* Add Comment */}
                      <div className="flex gap-2">
                        <Input
                          placeholder={t("writeAComment")}
                          value={commentInputs[post.id] || ""}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({
                              ...prev,
                              [post.id]: e.target.value,
                            }))
                          }
                          className="bg-violet-900/50 border-violet-400/40 text-white"
                        />
                        <Button type="button" onClick={() => sendComment(post.id)}>
                          {t("comment")}
                        </Button>
                      </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </section>

        <aside className="space-y-4">
          <div className="px-1">
            <h2 className="wedding-heading text-2xl text-white">{t("events")}</h2>
          </div>

          <Button
            asChild
            variant="outline"
            className="w-full border-white/20 text-white hover:bg-white/10"
          >
            <Link to="/calendar">{t("openCalendar")}</Link>
          </Button>

          <Button
            onClick={() => setShowCreateEvent(!showCreateEvent)}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("createEvent")}
          </Button>

          {showCreateEvent && (
            <Card className="bg-gradient-to-br from-pink-50 to-purple-50 border-pink-200">
              <CardContent className="p-4 space-y-3">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">
                    {t("realWorldEventIdeas")}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {EVENT_TEMPLATES.map((template) => (
                      <Button
                        key={template.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyEventTemplate(template)}
                        className="border-pink-200 bg-white/80 text-violet-700 hover:bg-pink-50"
                      >
                        {template.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <Input
                  placeholder={t("eventTitle")}
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                />
                <Textarea
                  placeholder={t("eventDescription")}
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  />
                  <Input
                    type="time"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                  />
                </div>
                <Input
                  placeholder={t("location")}
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                />
                <div className="rounded-xl border border-pink-200 bg-white/70 px-3 py-2 text-sm text-violet-700">
                  {t("inviteFriendsOutsideApp")}
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => void handleCreateEvent()}
                    className="flex-1"
                    disabled={creatingEvent}
                  >
                    {creatingEvent ? t("creating") : t("create")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateEvent(false)}
                    disabled={creatingEvent}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {eventsError ? <div className="text-sm text-red-300">{eventsError}</div> : null}

          {eventsLoading ? (
            <div className="text-white/80">{t("loadingEvents")}</div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-white/80">
              {activeCircle
                ? t("noUpcomingMeetupsInCircle", { circle: activeCircle })
                : t("noUpcomingEvents")}
            </div>
          ) : (
            filteredEvents.map((event) => (
              <div key={event.id} className="space-y-2">
                <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-white/75">
                  {event.visibility === "circle" ? event.circleName ?? "Circle" : getEventAudienceLabel(event)}
                </div>
                <EventCard
                  event={event}
                  onJoin={handleJoinEvent}
                  onInvite={handleInviteEvent}
                  onEdit={event.ownerId === user?.id ? beginEditEvent : undefined}
                  onDelete={event.ownerId === user?.id ? (eventId) => void deleteEvent(eventId) : undefined}
                  onRequestInfo={event.ownerId !== user?.id ? (eventId) => void requestEventInfo(eventId) : undefined}
                  actionBusy={!!eventActionById[event.id]}
                />

                {editingEventId === event.id && editingEvent ? (
                  <Card className="bg-black/30 border-white/15 text-white">
                    <CardContent className="p-3 space-y-3">
                      <div className="rounded-xl border border-white/15 bg-white/5 p-3 space-y-2">
                        <Input
                          value={editingEvent.title}
                          onChange={(e) =>
                            setEditingEvent((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                          }
                          placeholder="Event title"
                        />
                        <Textarea
                          value={editingEvent.description}
                          onChange={(e) =>
                            setEditingEvent((prev) =>
                              prev ? { ...prev, description: e.target.value } : prev
                            )
                          }
                          placeholder="Event description"
                          className="min-h-[90px]"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input
                            type="datetime-local"
                            value={editingEvent.startsAt}
                            onChange={(e) =>
                              setEditingEvent((prev) =>
                                prev ? { ...prev, startsAt: e.target.value } : prev
                              )
                            }
                          />
                          <Input
                            type="datetime-local"
                            value={editingEvent.endsAt}
                            onChange={(e) =>
                              setEditingEvent((prev) => (prev ? { ...prev, endsAt: e.target.value } : prev))
                            }
                          />
                        </div>
                        <Input
                          value={editingEvent.location}
                          onChange={(e) =>
                            setEditingEvent((prev) => (prev ? { ...prev, location: e.target.value } : prev))
                          }
                          placeholder="Location"
                        />
                        <select
                          value={editingEvent.visibility}
                          onChange={(e) =>
                            setEditingEvent((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    visibility: e.target.value as CalendarVisibility,
                                    circleName: e.target.value === "circle" ? prev.circleName : "",
                                  }
                                : prev
                            )
                          }
                          className="flex h-10 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                        >
                          <option value="private">Private to you</option>
                          <option value="shared">Open community</option>
                          <option value="circle">Circle only</option>
                        </select>
                        {editingEvent.visibility === "circle" ? (
                          <select
                            value={editingEvent.circleName}
                            onChange={(e) =>
                              setEditingEvent((prev) =>
                                prev ? { ...prev, circleName: e.target.value } : prev
                              )
                            }
                            className="flex h-10 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                          >
                            <option value="">Choose a circle</option>
                            {joinedCircles.map((circleName) => (
                              <option key={circleName} value={circleName}>
                                {circleName}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <div className="grid grid-cols-2 gap-2">
                          <Button onClick={() => void saveEditedEvent()} disabled={updatingEvent}>
                            {updatingEvent ? "Saving..." : "Save Changes"}
                          </Button>
                          <Button variant="outline" onClick={cancelEditEvent} disabled={updatingEvent}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            ))
          )}
        </aside>
      </div>
    </div>
  );
};

export default SocialFeed;
