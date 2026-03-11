import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { extractBlockedUserIds } from "@/lib/safety";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Flag, Heart, Lightbulb, Loader2, MessageCircle } from "lucide-react";

type ConversationMemberRow = {
  conversation_id: string;
  user_id: string;
  last_read_at: string | null;
  conversations?: {
    id: string;
    created_at: string;
    updated_at: string;
    last_message_at: string | null;
  } | null;
};

type OtherMemberRow = {
  conversation_id: string;
  user_id: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  photos: string[] | null;
};

type ConversationListItem = {
  conversationId: string;
  otherUserId: string;
  otherName: string;
  otherPhoto?: string | null;
  lastMessageAt: string | null;
  lastReadAt: string | null;
  hasUnread: boolean;
  lastMessagePreview?: string | null;
  lastMessageSenderId?: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type MessageReactionRow = {
  id: string;
  message_id: string;
  conversation_id: string;
  user_id: string;
  reaction: "heart";
  created_at: string;
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

function getInitials(name: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "V";
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function previewText(s?: string | null, max = 60) {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

const EMPTY_CHAT_PROMPTS = [
  "What made you smile today?",
  "What kind of connection are you hoping to find here?",
  "What's something you're excited about right now?",
];

const PROMPT_CATEGORIES = [
  {
    label: "Fun",
    prompts: [
      "What's something that always makes you laugh?",
      "If you had a free Saturday, how would you spend it?",
    ],
  },
  {
    label: "Values",
    prompts: [
      "What matters most to you in a connection?",
      "What's a quality you really appreciate in people?",
    ],
  },
  {
    label: "Local plans",
    prompts: [
      "Know any good coffee spots around here?",
      "What kind of local meetup would you actually enjoy?",
    ],
  },
  {
    label: "Safe-check",
    prompts: [
      "What helps you feel comfortable getting to know someone here?",
      "What does a respectful first conversation look like to you?",
    ],
  },
] as const;

const ChatView: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [heartCountsByMessageId, setHeartCountsByMessageId] = useState<
    Record<string, number>
  >({});
  const [heartedMessageIds, setHeartedMessageIds] = useState<Set<string>>(new Set());
  const [heartsEnabled, setHeartsEnabled] = useState(true);
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<string | null>(null);
  const [newDividerSeen, setNewDividerSeen] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [showOnlineEnabled, setShowOnlineEnabled] = useState(true);
  const [safetyLoaded, setSafetyLoaded] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showPromptPicker, setShowPromptPicker] = useState(false);

  const threadContainerRef = useRef<HTMLDivElement | null>(null);
  const newDividerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const otherTypingTimeoutRef = useRef<number | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const queryConversationId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("c");
  }, [location.search]);
  const blockedUserIdsKey = useMemo(
    () => Array.from(blockedUserIds).sort().join(","),
    [blockedUserIds]
  );

  // Keep URL -> state in sync
  useEffect(() => {
    if (!queryConversationId) return;
    if (!safetyLoaded) return;
    if (listLoading) return;

    const convo = conversations.find((c) => c.conversationId === queryConversationId);
    if (!convo || blockedUserIds.has(convo.otherUserId)) {
      setActiveConversationId(null);
      navigate("/chat", { replace: true });
      return;
    }

    setActiveConversationId(queryConversationId);

    // Clear unread immediately when opening from URL entry points.
    if (convo?.hasUnread) {
      void markConversationRead(queryConversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryConversationId, safetyLoaded, listLoading, conversations, blockedUserIdsKey, navigate]);

  useEffect(() => {
    if (queryConversationId) return;
    if (!activeConversationId && conversations.length > 0) {
      const first = conversations[0];
      const firstId = first.conversationId;
      setActiveConversationId(firstId);
      navigate(`/chat?c=${firstId}`, { replace: true });

      // Clear unread immediately for auto-selected thread.
      if (first.hasUnread) {
        void markConversationRead(firstId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryConversationId, conversations, activeConversationId]);

  const isNearBottom = () => {
    const el = threadContainerRef.current;
    if (!el) return true;

    const threshold = 120; // px from bottom considered "near"
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;

    return distanceFromBottom < threshold;
  };

  // Scroll to bottom when messages change, but only if user is already near bottom.
  useEffect(() => {
    if (!threadContainerRef.current) return;

    if (isNearBottom()) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const setReactionStateFromRows = (rows: MessageReactionRow[]) => {
    const nextCounts: Record<string, number> = {};
    const nextHearted = new Set<string>();

    rows.forEach((row) => {
      if (row.reaction !== "heart") return;
      nextCounts[row.message_id] = (nextCounts[row.message_id] ?? 0) + 1;
      if (row.user_id === user?.id) {
        nextHearted.add(row.message_id);
      }
    });

    setHeartCountsByMessageId(nextCounts);
    setHeartedMessageIds(nextHearted);
  };

  const loadMessageHearts = async (conversationId: string, messageIds: string[]) => {
    if (!user || !conversationId || !heartsEnabled) return;

    if (messageIds.length === 0) {
      setHeartCountsByMessageId({});
      setHeartedMessageIds(new Set());
      return;
    }

    const { data, error } = await supabase
      .from("message_reactions")
      .select("id, message_id, conversation_id, user_id, reaction, created_at")
      .eq("conversation_id", conversationId)
      .eq("reaction", "heart")
      .in("message_id", messageIds);

    if (error) {
      if (error.code === "42P01") {
        setHeartsEnabled(false);
        return;
      }
      throw error;
    }

    setReactionStateFromRows((data ?? []) as MessageReactionRow[]);
  };

  const loadConversationList = async () => {
    if (!user) {
      setConversations([]);
      setListLoading(false);
      setListError(null);
      return;
    }

    setListLoading(true);
    setListError(null);

    try {
      // 1) My memberships
      const { data: myMemberships, error: memErr } = await supabase
        .from("conversation_members")
        .select("conversation_id, user_id, last_read_at")
        .eq("user_id", user.id);

      if (memErr) throw memErr;

      const memberships = (myMemberships ?? []) as ConversationMemberRow[];
      const convoIds = memberships.map((m) => m.conversation_id);

      if (convoIds.length === 0) {
        setConversations([]);
        return;
      }

      // 2) Convo metadata
      const { data: convoRows, error: convoErr } = await supabase
        .from("conversations")
        .select("id, last_message_at, updated_at, created_at")
        .in("id", convoIds);

      if (convoErr) throw convoErr;

      const convoById = new Map<string, any>();
      (convoRows ?? []).forEach((c: any) => convoById.set(c.id, c));

      // 3) Find the "other" member per conversation
      const { data: otherRows, error: otherErr } = await supabase
        .from("conversation_members")
        .select("conversation_id, user_id")
        .in("conversation_id", convoIds)
        .neq("user_id", user.id);

      if (otherErr) throw otherErr;

      const others = (otherRows ?? []) as OtherMemberRow[];
      const otherUserIds = Array.from(new Set(others.map((r) => r.user_id)));

      // 4) Latest message preview per conversation
      const { data: msgRows, error: msgErr } = await supabase
        .from("messages")
        .select("conversation_id, sender_id, body, created_at")
        .in("conversation_id", convoIds)
        .order("created_at", { ascending: false })
        .limit(200);

      if (msgErr) throw msgErr;

      // Pick first (newest) message per conversation_id
      const latestByConvo = new Map<string, { body: string; sender_id: string; created_at: string }>();
      const latestOtherByConvo = new Map<
        string,
        { body: string; sender_id: string; created_at: string }
      >();
      (msgRows ?? []).forEach((m: any) => {
        if (!latestByConvo.has(m.conversation_id)) {
          latestByConvo.set(m.conversation_id, {
            body: m.body,
            sender_id: m.sender_id,
            created_at: m.created_at,
          });
        }
        if (m.sender_id !== user.id && !latestOtherByConvo.has(m.conversation_id)) {
          latestOtherByConvo.set(m.conversation_id, {
            body: m.body,
            sender_id: m.sender_id,
            created_at: m.created_at,
          });
        }
      });

      // 3) Pull names/photos for other users
      let profiles: ProfileRow[] = [];
      if (otherUserIds.length > 0) {
        const { data: profileRows, error: profErr } = await supabase
          .from("profiles")
          .select("id, full_name, username, photos")
          .in("id", otherUserIds);

        if (profErr) throw profErr;
        profiles = (profileRows ?? []) as ProfileRow[];
      }

      const profileById = new Map<string, ProfileRow>();
      profiles.forEach((p) => profileById.set(p.id, p));

      const lastReadByConvo = new Map<string, string | null>();

      memberships.forEach((m) => {
        lastReadByConvo.set(m.conversation_id, m.last_read_at ?? null);
      });

      const items: ConversationListItem[] = convoIds.map((cid) => {
        const otherUserId = others.find((o) => o.conversation_id === cid)?.user_id || "";
        const prof = otherUserId ? profileById.get(otherUserId) : undefined;

        const otherName = (prof?.full_name || prof?.username || "Member") as string;
        const otherPhoto = prof?.photos?.[0] ?? null;

        const lastReadAt = lastReadByConvo.get(cid) ?? null;
        const meta = convoById.get(cid);
        const lastMessageAt = meta?.last_message_at ?? null;
        const latest = latestOtherByConvo.get(cid) ?? latestByConvo.get(cid);
        const lastMessagePreview = previewText(latest?.body ?? null);
        const lastMessageSenderId = latest?.sender_id ?? null;

        // Simple unread heuristic:
        // unread if last_message_at exists and is newer than last_read_at
        const hasUnread =
          !!lastMessageAt &&
          (!lastReadAt || new Date(lastMessageAt).getTime() > new Date(lastReadAt).getTime());

        return {
          conversationId: cid,
          otherUserId,
          otherName,
          otherPhoto,
          lastMessageAt,
          lastReadAt,
          hasUnread,
          lastMessagePreview,
          lastMessageSenderId,
        };
      });

      const visibleItems = items.filter(
        (item) => !blockedUserIds.has(item.otherUserId)
      );

      // Sort by lastMessageAt desc (fallback to updated order)
      visibleItems.sort((a, b) => {
        const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return tb - ta;
      });

      setConversations(visibleItems);
    } catch (e: any) {
      console.error(e);
      setListError(e?.message || "Failed to load conversations");
    } finally {
      setListLoading(false);
    }
  };

  const markConversationRead = async (conversationId: string) => {
    if (!user) return;
    const now = new Date().toISOString();

    // optimistic list update
    setConversations((prev) =>
      prev.map((c) =>
        c.conversationId === conversationId
          ? { ...c, lastReadAt: now, hasUnread: false }
          : c
      )
    );

    const { error } = await supabase
      .from("conversation_members")
      .update({ last_read_at: now })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);

    if (error) {
      console.warn("markConversationRead error:", error.message);
      // Not fatal—leave UI as-is; next reload will reconcile.
    }
  };

  const loadThread = async (conversationId: string) => {
    if (!user) return;

    const activeConvo = conversations.find((c) => c.conversationId === conversationId);
    if (!activeConvo || blockedUserIds.has(activeConvo.otherUserId)) {
      setMessages([]);
      setHeartCountsByMessageId({});
      setHeartedMessageIds(new Set());
      setThreadError("This conversation is unavailable.");
      return;
    }

    setThreadLoading(true);
    setThreadError(null);

    try {
      // 0) Get my last_read_at BEFORE marking read
      const { data: memRow, error: memErr } = await supabase
        .from("conversation_members")
        .select("last_read_at")
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id)
        .single();

      if (memErr) throw memErr;
      const lastReadAt = memRow?.last_read_at as string | null;

      // 1) Load messages
      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (error) throw error;

      const rows = (data ?? []) as MessageRow[];
      setMessages(rows);
      await loadMessageHearts(conversationId, rows.map((m) => m.id));

      // 2) Compute first unread message id (only messages after last_read_at, not mine)
      if (!lastReadAt) {
        setFirstUnreadMessageId(null);
      } else {
        const firstUnread = rows.find(
          (m) =>
            m.sender_id !== user.id &&
            new Date(m.created_at).getTime() > new Date(lastReadAt).getTime()
        );
        setFirstUnreadMessageId(firstUnread?.id ?? null);
      }

      // 3) Mark conversation read (existing behavior)
      await markConversationRead(conversationId);
    } catch (e: any) {
      console.error(e);
      setHeartCountsByMessageId({});
      setHeartedMessageIds(new Set());
      setThreadError(e?.message || "Failed to load messages");
    } finally {
      setThreadLoading(false);
    }
  };

  const toggleMessageHeart = async (message: MessageRow) => {
    if (!user || !activeConversationId || !heartsEnabled) return;
    if (message.id.startsWith("temp_")) return;

    const messageId = message.id;
    const hadHeart = heartedMessageIds.has(messageId);
    const prevCount = heartCountsByMessageId[messageId] ?? 0;
    const nextCount = Math.max(0, prevCount + (hadHeart ? -1 : 1));

    setHeartCountsByMessageId((prev) => ({ ...prev, [messageId]: nextCount }));
    setHeartedMessageIds((prev) => {
      const next = new Set(prev);
      if (hadHeart) next.delete(messageId);
      else next.add(messageId);
      return next;
    });

    try {
      if (hadHeart) {
        const { error } = await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("conversation_id", activeConversationId)
          .eq("reaction", "heart")
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("message_reactions").insert({
          message_id: messageId,
          conversation_id: activeConversationId,
          user_id: user.id,
          reaction: "heart",
        });
        if (error && error.code !== "23505") throw error;
      }
    } catch (e: any) {
      if (e?.code === "42P01") {
        setHeartsEnabled(false);
      }

      // rollback optimistic update
      setHeartCountsByMessageId((prev) => ({ ...prev, [messageId]: prevCount }));
      setHeartedMessageIds((prev) => {
        const next = new Set(prev);
        if (hadHeart) next.add(messageId);
        else next.delete(messageId);
        return next;
      });

      toast({
        title: "Could not update heart",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const sendMessage = async () => {
    if (!user || !activeConversationId) return;
    const body = draft.trim();
    if (!body) return;

    setSending(true);

    // optimistic message
    const tempId = `temp_${Date.now()}`;
    const optimistic: MessageRow = {
      id: tempId,
      conversation_id: activeConversationId,
      sender_id: user.id,
      body,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: activeConversationId,
          sender_id: user.id,
          body,
        })
        .select("id, conversation_id, sender_id, body, created_at")
        .single();

      if (error) throw error;

      // replace optimistic with real row
      setMessages((prev) => prev.map((m) => (m.id === tempId ? (data as MessageRow) : m)));
      setHeartCountsByMessageId((prev) => {
        if (!(tempId in prev)) return prev;
        const next = { ...prev, [(data as MessageRow).id]: prev[tempId] };
        delete next[tempId];
        return next;
      });
      setHeartedMessageIds((prev) => {
        if (!prev.has(tempId)) return prev;
        const next = new Set(prev);
        next.delete(tempId);
        next.add((data as MessageRow).id);
        return next;
      });

      // conversation list: bump lastMessageAt + clear unread (for me)
      setConversations((prev) =>
        prev.map((c) =>
          c.conversationId === activeConversationId
            ? { ...c, lastMessageAt: (data as any).created_at, hasUnread: false }
            : c
        )
      );

      await markConversationRead(activeConversationId);
    } catch (e: any) {
      console.error(e);
      // remove optimistic
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(body);
      setThreadError(e?.message || "Could not send message");
    } finally {
      setSending(false);
    }
  };

  const reportConversation = async () => {
    if (!user || !active) return;

    const confirmed = window.confirm(
      `Report ${active.otherName}? This will open an email draft to the safety team.`
    );
    if (!confirmed) return;

    const safetyEmail = import.meta.env.VITE_SAFETY_EMAIL || "safety@violetsandvibes.com";
    const nowIso = new Date().toISOString();

    // Best-effort local safety log for the reporting user.
    try {
      const { data: ownProfile } = await supabase
        .from("profiles")
        .select("safety_settings")
        .eq("id", user.id)
        .maybeSingle();

      const currentSafety =
        ownProfile?.safety_settings && typeof ownProfile.safety_settings === "object"
          ? (ownProfile.safety_settings as Record<string, any>)
          : {};

      const reportedIds = Array.isArray(currentSafety.reported_user_ids)
        ? currentSafety.reported_user_ids
        : [];

      const nextReportedIds = Array.from(new Set([...reportedIds, active.otherUserId]));

      await supabase
        .from("profiles")
        .update({
          safety_settings: {
            ...currentSafety,
            reported_user_ids: nextReportedIds,
            last_reported_at: nowIso,
          },
          updated_at: nowIso,
        })
        .eq("id", user.id);
    } catch (error) {
      console.warn("Could not persist report metadata:", error);
    }

    const subject = encodeURIComponent(`Safety report: chat with ${active.otherName}`);
    const body = encodeURIComponent(
      [
        "I want to report a conversation for review.",
        "",
        `Reporter user id: ${user.id}`,
        `Reported user id: ${active.otherUserId || "unknown"}`,
        `Conversation id: ${active.conversationId}`,
        `Timestamp: ${nowIso}`,
        "",
        "Details:",
      ].join("\n")
    );

    window.location.href = `mailto:${safetyEmail}?subject=${subject}&body=${body}`;

    toast({
      title: "Safety report started",
      description: `If your email app did not open, contact ${safetyEmail}.`,
    });
  };

  const onDraftChange = (v: string) => {
    setDraft(v);

    const ch = typingChannelRef.current;
    if (!user || !activeConversationId || !ch) return;

    // tell other user I'm typing
    void ch.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user.id, isTyping: true },
    });

    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      void ch.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: user.id, isTyping: false },
      });
      typingTimerRef.current = null;
    }, 900);
  };

  const applyPrompt = (prompt: string) => {
    onDraftChange(prompt);
    setShowPromptPicker(false);
  };

  useEffect(() => {
    let cancelled = false;

    const loadPrivacy = async () => {
      setSafetyLoaded(false);

      if (!user?.id) {
        setShowOnlineEnabled(true);
        setBlockedUserIds(new Set());
        setSafetyLoaded(true);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("privacy_settings, safety_settings")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;
        if (cancelled) return;

        const privacy =
          data?.privacy_settings && typeof data.privacy_settings === "object"
            ? (data.privacy_settings as Record<string, any>)
            : {};
        const blockedIds = extractBlockedUserIds(data?.safety_settings);

        setShowOnlineEnabled(privacy.showOnline !== false);
        setBlockedUserIds(new Set(blockedIds));
      } catch (error) {
        console.warn("Could not load showOnline preference for chat presence:", error);
        if (!cancelled) {
          setShowOnlineEnabled(true);
          setBlockedUserIds(new Set());
        }
      } finally {
        if (!cancelled) {
          setSafetyLoaded(true);
        }
      }
    };

    void loadPrivacy();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Load thread when activeConversationId changes
  useEffect(() => {
    setNewDividerSeen(false);
    setFirstUnreadMessageId(null);
    if (!user || !activeConversationId) {
      setMessages([]);
      setHeartCountsByMessageId({});
      setHeartedMessageIds(new Set());
      return;
    }
    void loadThread(activeConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeConversationId, blockedUserIdsKey]);

  useEffect(() => {
    if (!firstUnreadMessageId) return;
    if (newDividerSeen) return;

    const el = newDividerRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e?.isIntersecting) {
          setNewDividerSeen(true);
          // remove divider after user reaches it
          setFirstUnreadMessageId(null);
        }
      },
      {
        root: null,
        threshold: 0.4, // divider "mostly" visible
      }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [firstUnreadMessageId, newDividerSeen]);

  useEffect(() => {
    if (!user || !activeConversationId) {
      setOtherOnline(false);
      return;
    }

    const channel = supabase.channel(`vv-presence-${activeConversationId}`, {
      config: { presence: { key: user.id } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, any[]>;
      // state keys are presence keys
      const keys = Object.keys(state);
      // "otherOnline" means anyone besides me is present
      setOtherOnline(keys.some((k) => k !== user.id));
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED" && showOnlineEnabled) {
        await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
      }
    });

    return () => {
      setOtherOnline(false);
      supabase.removeChannel(channel);
    };
  }, [user?.id, activeConversationId, showOnlineEnabled]);

  useEffect(() => {
    if (!user || !activeConversationId) {
      setOtherTyping(false);
      setShowPromptPicker(false);
      return;
    }

    const channel = supabase.channel(`vv-typing-${activeConversationId}`);
    typingChannelRef.current = channel;

    channel.on("broadcast", { event: "typing" }, (payload) => {
      const { userId, isTyping } = (payload as any).payload || {};
      if (!userId || userId === user.id) return;

      setOtherTyping(!!isTyping);

      if (otherTypingTimeoutRef.current) window.clearTimeout(otherTypingTimeoutRef.current);
      if (isTyping) {
        otherTypingTimeoutRef.current = window.setTimeout(() => {
          setOtherTyping(false);
        }, 2500);
      }
    });

    channel.subscribe();

    return () => {
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      if (otherTypingTimeoutRef.current) {
        window.clearTimeout(otherTypingTimeoutRef.current);
        otherTypingTimeoutRef.current = null;
      }
      setOtherTyping(false);
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [user?.id, activeConversationId]);

  useEffect(() => {
    if (!user) return;

    // Subscribe to any message INSERTs for conversations where I'm a member
    const channel = supabase
      .channel(`vv-chat-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const row = (payload as any).new as MessageRow | undefined;
          if (!row?.conversation_id) return;

          // Gate: only react if I'm a member of that conversation.
          // (This prevents seeing messages from conversations I'm not part of.)
          const { data: memberRow, error: memErr } = await supabase
            .from("conversation_members")
            .select("conversation_id")
            .eq("conversation_id", row.conversation_id)
            .eq("user_id", user.id)
            .maybeSingle();

          if (memErr || !memberRow) return;

          // 1) If this is the active thread, append (dedupe-safe)
          setMessages((prev) => {
            if (row.conversation_id !== activeConversationId) return prev;
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });

          // 2) Update conversation list: preview, time, unread, move to top
          setConversations((prev) => {
            const next = prev.map((c) => {
              if (c.conversationId !== row.conversation_id) return c;

              const isMine = row.sender_id === user.id;
              const nowIso = row.created_at;

              // If I sent it, don't mark unread for me.
              const hasUnread = isMine ? false : true;

              return {
                ...c,
                lastMessageAt: nowIso,
                lastMessagePreview: isMine
                  ? c.lastMessagePreview ?? previewText(row.body)
                  : previewText(row.body),
                lastMessageSenderId: isMine
                  ? c.lastMessageSenderId ?? row.sender_id
                  : row.sender_id,
                hasUnread,
              };
            });

            // Move this conversation to top
            next.sort((a, b) => {
              const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
              const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
              return tb - ta;
            });

            return next;
          });

          // 3) Keep server truth up to date (best effort)
          // Update conversations.last_message_at (optional but recommended)
          await supabase
            .from("conversations")
            .update({ last_message_at: row.created_at })
            .eq("id", row.conversation_id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // IMPORTANT: include activeConversationId so thread appends correctly
  }, [user?.id, activeConversationId]);

  useEffect(() => {
    if (!user || !activeConversationId || !heartsEnabled) return;

    const channel = supabase
      .channel(`vv-chat-hearts-${activeConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_reactions",
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        (payload) => {
          const row = (payload as any).new as MessageReactionRow | undefined;
          if (!row || row.reaction !== "heart") return;
          if (row.user_id === user.id) return;

          setHeartCountsByMessageId((prev) => ({
            ...prev,
            [row.message_id]: (prev[row.message_id] ?? 0) + 1,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, activeConversationId, heartsEnabled]);

  // Realtime subscription:
  // - conversation_members updates for me (unread/read reconciliation)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("vv-chat")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_members" },
        (payload) => {
          const row = (payload as any).new as any;
          if (!row) return;
          if (row.user_id !== user.id) return;

          setConversations((prev) =>
            prev.map((c) => {
              if (c.conversationId !== row.conversation_id) return c;
              const lastReadAt = row.last_read_at ?? null;
              const lastMessageAt = c.lastMessageAt ?? null;

              const hasUnread =
                !!lastMessageAt &&
                (!lastReadAt ||
                  new Date(lastMessageAt).getTime() > new Date(lastReadAt).getTime());

              return { ...c, lastReadAt, hasUnread };
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, activeConversationId]); // intentional dependency

  // Reload conversation list whenever block list changes.
  useEffect(() => {
    if (!user || !safetyLoaded) return;
    void loadConversationList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, blockedUserIdsKey, safetyLoaded]);

  const active = useMemo(
    () => conversations.find((c) => c.conversationId === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  if (!user) {
    return (
      <div className="p-6 text-center text-white/80">
        Please sign in to use chat.
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <div className="h-full w-full md:grid md:grid-cols-[340px_1fr]">
        {/* LEFT: Conversation list */}
        <div
          className={`glass-pride border-b md:border-b-0 md:border-r border-white/10 ${
            activeConversationId ? "hidden md:block" : "block"
          }`}
        >
          <div className="p-4 flex items-center justify-between">
            <div className="text-white font-semibold flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-pink-300" />
              Chat
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={loadConversationList}
            >
              Refresh
            </Button>
          </div>

          {listLoading ? (
            <div className="p-4 text-white/70 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading conversations…
            </div>
          ) : listError ? (
            <div className="p-4 text-pink-200">{listError}</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-white/70">
              No conversations yet. Go to a profile and tap “Message”.
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {conversations.map((c) => {
                const isActive = c.conversationId === activeConversationId;
                return (
                  <button
                    key={c.conversationId}
                    type="button"
                    onClick={() => {
                      setActiveConversationId(c.conversationId);
                      navigate(`/chat?c=${c.conversationId}`, { replace: false });

                      // clear unread immediately for better UX
                      if (c.hasUnread) {
                        void markConversationRead(c.conversationId);
                      }
                    }}
                    className={`w-full text-left rounded-xl p-3 transition-all border ${
                      isActive
                        ? "bg-white/10 border-violet-300/40 backdrop-blur-md shadow-lg"
                        : "bg-white/5 border-white/10 backdrop-blur-md shadow-lg hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="relative">
                        {c.otherPhoto ? (
                          <img
                            src={c.otherPhoto}
                            alt={c.otherName}
                            className="w-10 h-10 rounded-full object-cover border border-white/15"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white font-semibold">
                            {getInitials(c.otherName)}
                          </div>
                        )}
                        {c.hasUnread && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-white font-semibold truncate">
                            {c.otherName}
                          </div>
                          <div className="text-xs text-white/60 shrink-0">
                            {timeAgo(c.lastMessageAt)}
                          </div>
                        </div>
                        <div className="text-xs text-white/55 mt-0.5 truncate">
                          {c.lastMessagePreview
                            ? c.lastMessagePreview
                            : c.hasUnread
                              ? "New messages"
                              : "—"}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Thread */}
        <div
          className={`h-full flex-col bg-[#0F0B1F] ${
            activeConversationId ? "flex" : "hidden md:flex"
          }`}
        >
          {/* Thread header */}
          <div className="border-b border-white/10 bg-white/5 backdrop-blur-md p-3 sm:p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="md:hidden h-8 w-8 text-white hover:bg-white/10"
                onClick={() => setActiveConversationId(null)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div>
              <div className="text-white font-semibold">
                {active ? active.otherName : "Select a conversation"}
              </div>
              {active ? (
                otherOnline ? (
                  <div className="text-xs text-green-300">Online</div>
                ) : (
                  <div className="text-xs text-white/50">Offline</div>
                )
              ) : null}
              {active ? (
                otherTyping ? (
                  <div className="text-xs text-white/70">Typing…</div>
                ) : null
              ) : null}
              </div>
            </div>
            {active ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-400/40 text-red-100 hover:bg-red-500/15"
                  onClick={() => void reportConversation()}
                >
                  <Flag className="w-3.5 h-3.5 mr-1.5" />
                  Report Conversation
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="hidden sm:inline-flex border-white/20 text-white hover:bg-white/10"
                  onClick={() => markConversationRead(active.conversationId)}
                >
                  Mark read
                </Button>
              </div>
            ) : null}
          </div>

          {activeConversationId ? (
            <div className="px-4 py-2 border-b border-white/10 bg-white/5 text-[11px] sm:text-xs text-white/75">
              Respect and accountability are expected in all conversations.
            </div>
          ) : null}

          {/* Messages */}
          <div
            ref={threadContainerRef}
            className="flex-1 overflow-y-auto bg-[#0F0B1F] p-4 space-y-2"
          >
            {!activeConversationId ? (
              <div className="text-white/70">
                Choose someone to start chatting 💜
              </div>
            ) : threadLoading ? (
              <div className="text-white/70 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading messages…
              </div>
            ) : threadError ? (
              <Card className="bg-pink-900/20 border-pink-400/30 text-pink-100 p-3">
                {threadError}
              </Card>
            ) : messages.length === 0 ? (
              <div className="text-white/70">
                No messages yet. Say hi ✨
              </div>
            ) : (
              messages.map((m) => {
                const mine = m.sender_id === user.id;
                const showDivider = m.id === firstUnreadMessageId;
                const isHearted = heartedMessageIds.has(m.id);
                const heartCount = heartCountsByMessageId[m.id] ?? 0;
                const canHeart = heartsEnabled && !m.id.startsWith("temp_");

                return (
                  <React.Fragment key={m.id}>
                    {showDivider && (
                      <div
                        ref={newDividerRef}
                        className="flex items-center gap-3 my-3"
                      >
                        <div className="h-px flex-1 bg-white/15" />
                        <div className="text-[11px] px-2 py-1 rounded-full bg-white/10 text-white/70 border border-white/10">
                          New messages
                        </div>
                        <div className="h-px flex-1 bg-white/15" />
                      </div>
                    )}

                    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap shadow-[0_12px_30px_rgba(0,0,0,0.22)] ${
                          mine
                            ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white"
                            : "border border-white/10 bg-[#2B1F3F] text-white/92"
                        }`}
                      >
                        {m.body}
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <div className="text-[11px] opacity-70">{timeAgo(m.created_at)}</div>
                          {heartsEnabled ? (
                            <button
                              type="button"
                              disabled={!canHeart}
                              onClick={() => void toggleMessageHeart(m)}
                              className={`inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 border transition ${
                                isHearted
                                  ? "border-pink-300/60 bg-pink-500/20 text-pink-100"
                                  : "border-white/20 bg-white/10 text-white/80"
                              } ${canHeart ? "hover:bg-white/20" : "opacity-60 cursor-not-allowed"}`}
                              title={isHearted ? "Remove heart" : "Heart this message"}
                            >
                              <Heart className={`w-3 h-3 ${isHearted ? "fill-current" : ""}`} />
                              {heartCount > 0 ? heartCount : null}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {otherTyping && (
            <div className="text-xs text-white/70 px-4 pb-2">
              Typing…
            </div>
          )}

          {/* Composer */}
          <div className="border-t border-white/10 bg-white/5 backdrop-blur-md p-4">
            {showPromptPicker && activeConversationId ? (
              <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-lg p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {PROMPT_CATEGORIES.map((category) => (
                    <div key={category.label} className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                        {category.label}
                      </div>
                      <div className="space-y-2">
                        {category.prompts.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => applyPrompt(prompt)}
                            className="w-full rounded-xl border border-pink-300/15 bg-white/5 px-3 py-2 text-left text-sm text-white/85 transition hover:bg-white/10"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {activeConversationId && !threadLoading && !threadError && messages.length === 0 ? (
              <div className="mb-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                  Start with a prompt
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {EMPTY_CHAT_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => onDraftChange(prompt)}
                      className="rounded-2xl border border-pink-300/20 bg-white/5 px-4 py-3 text-left text-sm text-white/85 transition hover:bg-white/10"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPromptPicker((prev) => !prev)}
                disabled={!activeConversationId || sending}
                className="shrink-0 border-white/20 bg-white/5 px-3 text-white hover:bg-white/10"
                title="Prompt"
              >
                <Lightbulb className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">Prompt</span>
              </Button>
              <Input
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                placeholder={activeConversationId ? "Write a message…" : "Select a conversation…"}
                disabled={!activeConversationId || sending}
                className="bg-violet-900/30 border-violet-400/30 text-white placeholder:text-white/50"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
              />
              <Button
                onClick={sendMessage}
                disabled={!activeConversationId || sending || !draft.trim()}
                className="bg-pink-500 hover:bg-pink-600"
              >
                {sending ? "Sending…" : "Send"}
              </Button>
            </div>
            <div className="text-[11px] text-white/50 mt-2">
              Press Enter to send • Shift+Enter for a new line
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
