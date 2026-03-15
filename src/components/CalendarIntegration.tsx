import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  MessageCircleMore,
  RefreshCw,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { invokeEdgeFunction, supabase } from "@/lib/supabase";
import EventCard from "./EventCard";
import { communityCircles } from "./CommunityCirclesCard";
import { Link, useNavigate } from "react-router-dom";

type Provider = "google" | "outlook";
type PlannerTab = "planner" | "events" | "create";
type CalendarViewMode = "month" | "week" | "agenda";

type ProviderStatus = {
  connected: boolean;
  providerAccountEmail: string | null;
  providerCalendarId: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
};

type CalendarStatusResponse = {
  providers: Record<Provider, ProviderStatus>;
  connectedCount: number;
  hasAnyConnection: boolean;
};

type CalendarEventRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  location: string | null;
  circle_name: string | null;
  starts_at: string;
  ends_at: string;
  source: "local" | "google" | "outlook";
  source_event_id: string | null;
  sync_state: "pending" | "synced" | "error";
  sync_error: string | null;
  created_at: string;
};

type PlannerEvent = CalendarEventRow & {
  organizer: string;
  isOwnedByMe: boolean;
  audienceLabel: string;
};

type CreateEventForm = {
  title: string;
  description: string;
  location: string;
  circleName: string;
  startsAt: string;
  endsAt: string;
};

type EventEditForm = {
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
};

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
] as const;

const defaultProviderStatus: Record<Provider, ProviderStatus> = {
  google: {
    connected: false,
    providerAccountEmail: null,
    providerCalendarId: null,
    expiresAt: null,
    updatedAt: null,
  },
  outlook: {
    connected: false,
    providerAccountEmail: null,
    providerCalendarId: null,
    expiresAt: null,
    updatedAt: null,
  },
};

const CALENDAR_VIEW_STORAGE_KEY = "vv-calendar-view-mode";
const PLANNER_FILTER_ALL = "__all__";
const PLANNER_FILTER_MINE = "__mine__";
const PLANNER_FILTER_OPEN = "__open__";

const formatInputDateTime = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const initialCreateForm = (): CreateEventForm => {
  const start = new Date();
  start.setHours(start.getHours() + 2, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return {
    title: "",
    description: "",
    location: "",
    circleName: "",
    startsAt: formatInputDateTime(start),
    endsAt: formatInputDateTime(end),
  };
};

const readPreferredCalendarView = (): CalendarViewMode => {
  if (typeof window === "undefined") return "month";
  const stored = window.localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY);
  return stored === "week" || stored === "agenda" ? stored : "month";
};

const toUtcStamp = (dateInput: string | Date) => {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
    d.getUTCHours()
  )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

const formatEventDate = (iso: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));

const formatEventTimeRange = (startIso: string, endIso: string) => {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(startIso))} - ${formatter.format(new Date(endIso))}`;
};

const sourceBadgeClass: Record<CalendarEventRow["source"], string> = {
  local: "bg-pink-500/20 text-pink-100 border-pink-300/40",
  google: "bg-emerald-500/20 text-emerald-100 border-emerald-300/40",
  outlook: "bg-blue-500/20 text-blue-100 border-blue-300/40",
};

const syncBadgeClass: Record<CalendarEventRow["sync_state"], string> = {
  pending: "bg-yellow-500/20 text-yellow-100 border-yellow-300/40",
  synced: "bg-green-500/20 text-green-100 border-green-300/40",
  error: "bg-rose-500/20 text-rose-100 border-rose-300/40",
};

const escapeIcsValue = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

const buildGoogleUrl = (event: CalendarEventRow) => {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    details: event.description || "",
    location: event.location || "",
    dates: `${toUtcStamp(event.starts_at)}/${toUtcStamp(event.ends_at)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

const buildOutlookUrl = (event: CalendarEventRow) => {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    body: event.description || "",
    location: event.location || "",
    startdt: new Date(event.starts_at).toISOString(),
    enddt: new Date(event.ends_at).toISOString(),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
};

const downloadIcs = (event: CalendarEventRow) => {
  const nowStamp = toUtcStamp(new Date());
  const startStamp = toUtcStamp(event.starts_at);
  const endStamp = toUtcStamp(event.ends_at);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Violets and Vibes//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@violetsandvibes.com`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART:${startStamp}`,
    `DTEND:${endStamp}`,
    `SUMMARY:${escapeIcsValue(event.title)}`,
    `DESCRIPTION:${escapeIcsValue(event.description || "")}`,
    `LOCATION:${escapeIcsValue(event.location || "")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

const getCalendarFunctionErrorMessage = async (
  error: unknown,
  action: "connect" | "sync" | "status"
) => {
  let rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const context = (error as any)?.context;
  if (context && typeof context.clone === "function" && typeof context.json === "function") {
    try {
      const payload = await context.clone().json();
      const contextMessage =
        typeof payload?.error === "string"
          ? payload.error
          : typeof payload?.message === "string"
            ? payload.message
            : null;
      if (contextMessage) {
        rawMessage = contextMessage;
      }
    } catch {
      // Ignore parse failures and fall back to default message handling.
    }
  }

  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes("missing authorization header") ||
    normalized.includes("invalid authorization header format") ||
    normalized.includes("unauthorized") ||
    normalized.includes("jwt")
  ) {
    return "Your session expired. Please sign out and sign back in, then connect your calendar again.";
  }

  if (normalized.includes("missing required environment variable")) {
    return "Calendar provider keys are not configured yet. Finish the Supabase Edge Function secrets setup, then try again.";
  }

  if (
    normalized.includes("failed to send a request to the edge function") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("fetch")
  ) {
    if (action === "connect") {
      return "Calendar connection is not available right now. You can still create events here and use Google, Outlook, or Apple .ics export below.";
    }
    if (action === "sync") {
      return "Calendar sync is not available right now. Your events are still saved locally in the app.";
    }
    return "Calendar services are temporarily unavailable. Local events still work in the app.";
  }

  return rawMessage || "Please try again.";
};

const eventOccursOnDay = (event: PlannerEvent, day: Date) => {
  const eventStart = parseISO(event.starts_at);
  const eventEnd = parseISO(event.ends_at);
  const dayStart = startOfDay(day);
  const nextDay = addDays(dayStart, 1);
  return eventStart < nextDay && eventEnd >= dayStart;
};

const plannerFilterLabel = (value: string, joinedCircles: string[]) => {
  if (value === PLANNER_FILTER_ALL) return "All activity";
  if (value === PLANNER_FILTER_MINE) return "My calendar";
  if (value === PLANNER_FILTER_OPEN) return "Open community";
  return joinedCircles.find((circle) => circle === value) || value;
};

const getPlannerRangeLabel = (view: CalendarViewMode, cursorDate: Date) => {
  if (view === "month") {
    return format(cursorDate, "MMMM yyyy");
  }

  if (view === "week") {
    const weekStart = startOfWeek(cursorDate);
    const weekEnd = endOfWeek(cursorDate);
    return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
  }

  return `Agenda from ${format(cursorDate, "MMM d, yyyy")}`;
};

const CalendarIntegration: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [status, setStatus] = useState<CalendarStatusResponse>({
    providers: defaultProviderStatus,
    connectedCount: 0,
    hasAnyConnection: false,
  });
  const [events, setEvents] = useState<CalendarEventRow[]>([]);
  const [communityEvents, setCommunityEvents] = useState<CalendarEventRow[]>([]);
  const [ownerNamesById, setOwnerNamesById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<Provider | null>(null);
  const [form, setForm] = useState<CreateEventForm>(initialCreateForm);
  const [autoSynced, setAutoSynced] = useState(false);
  const [joinedCircles, setJoinedCircles] = useState<string[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventForm, setEditingEventForm] = useState<EventEditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PlannerTab>("planner");
  const [calendarView, setCalendarView] = useState<CalendarViewMode>(readPreferredCalendarView);
  const [plannerFilter, setPlannerFilter] = useState<string>(PLANNER_FILTER_ALL);
  const [calendarCursorDate, setCalendarCursorDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [providerStatusNotice, setProviderStatusNotice] = useState<string | null>(null);
  const [communityNotice, setCommunityNotice] = useState<string | null>(null);

  const circleByName = useMemo(
    () => new Map(communityCircles.map((circle) => [circle.name, circle])),
    []
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, calendarView);
    }
  }, [calendarView]);

  const hydrateOwnerNames = useCallback(async (ownerIds: string[]) => {
    const ids = Array.from(new Set(ownerIds.filter(Boolean)));
    if (ids.length === 0) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, username")
      .in("id", ids);

    if (error) {
      console.warn("Could not hydrate calendar owner names:", error.message);
      return;
    }

    setOwnerNamesById((prev) => {
      const next = { ...prev };
      ((data ?? []) as Array<{ id: string; full_name: string | null; username: string | null }>).forEach(
        (profile) => {
          next[profile.id] = profile.full_name || profile.username || "Member";
        }
      );
      return next;
    });
  }, []);

  const loadStatus = useCallback(async () => {
    const { data, error } = await invokeEdgeFunction(
      "calendar-status",
      {},
      { authTransport: "custom" }
    );
    if (error) throw error;

    const result = data as Partial<CalendarStatusResponse>;
    const providers = {
      google: {
        ...defaultProviderStatus.google,
        ...(result?.providers?.google || {}),
      },
      outlook: {
        ...defaultProviderStatus.outlook,
        ...(result?.providers?.outlook || {}),
      },
    };

    setStatus({
      providers,
      connectedCount: Number(result?.connectedCount || 0),
      hasAnyConnection: !!result?.hasAnyConnection,
    });
    setProviderStatusNotice(null);
  }, []);

  const loadJoinedCircles = useCallback(async () => {
    if (!user?.id) {
      setJoinedCircles([]);
      return [] as string[];
    }

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
    const nextCircles = Array.isArray(stored)
      ? stored.filter((value): value is string => typeof value === "string")
      : [];

    setJoinedCircles(nextCircles);
    return nextCircles;
  }, [user?.id]);

  const loadEvents = useCallback(async () => {
    if (!user) {
      setEvents([]);
      return;
    }

    const { data, error } = await supabase
      .from("calendar_events")
      .select(
        "id, user_id, title, description, location, circle_name, starts_at, ends_at, source, source_event_id, sync_state, sync_error, created_at"
      )
      .eq("user_id", user.id)
      .order("starts_at", { ascending: true })
      .limit(500);

    if (error) throw error;
    setEvents((data || []) as CalendarEventRow[]);
  }, [user]);

  const loadCommunityEvents = useCallback(
    async (circleNames: string[]) => {
      if (!user) {
        setCommunityEvents([]);
        return;
      }

      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("calendar_events")
        .select(
          "id, user_id, title, description, location, circle_name, starts_at, ends_at, source, source_event_id, sync_state, sync_error, created_at"
        )
        .eq("source", "local")
        .gte("ends_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(200);

      if (error) throw error;

      const visibleRows = ((data || []) as CalendarEventRow[]).filter((row) => {
        if (row.user_id === user.id) return false;
        if (!row.circle_name) return true;
        return circleNames.includes(row.circle_name);
      });

      setCommunityEvents(visibleRows);
      void hydrateOwnerNames(visibleRows.map((row) => row.user_id));
      setCommunityNotice(null);
    },
    [hydrateOwnerNames, user]
  );

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const circleNames = await loadJoinedCircles();
      const [statusResult, eventsResult, communityResult] = await Promise.allSettled([
        loadStatus(),
        loadEvents(),
        loadCommunityEvents(circleNames),
      ]);

      if (statusResult.status === "rejected") {
        console.error("Failed to load calendar provider status:", statusResult.reason);
        setStatus({
          providers: defaultProviderStatus,
          connectedCount: 0,
          hasAnyConnection: false,
        });
        setProviderStatusNotice(await getCalendarFunctionErrorMessage(statusResult.reason, "status"));
      }

      if (eventsResult.status === "rejected") {
        console.error("Failed to load personal calendar events:", eventsResult.reason);
        toast({
          variant: "destructive",
          title: "Could not load your calendar",
          description: "Your planner needs your local events to render. Please refresh and try again.",
        });
      }

      if (communityResult.status === "rejected") {
        console.error("Failed to load circle calendar events:", communityResult.reason);
        setCommunityEvents([]);
        setCommunityNotice("Circle events could not be loaded right now. Your own calendar still works.");
      }
    } finally {
      setLoading(false);
    }
  }, [loadCommunityEvents, loadEvents, loadJoinedCircles, loadStatus, toast, user]);

  const runSync = useCallback(
    async (payload?: Record<string, unknown>, options?: { silent?: boolean }) => {
      if (!user) return;

      setSyncing(true);
      try {
        const { data, error } = await invokeEdgeFunction(
          "calendar-sync",
          {
            body: payload || {},
          },
          { authTransport: "custom" }
        );

        if (error) throw error;

        const result = (data || {}) as {
          pushed?: number;
          imported?: number;
          skipped?: number;
          errors?: string[];
        };

        await loadAll();

        if (!options?.silent) {
          const pushed = result.pushed || 0;
          const imported = result.imported || 0;
          const errorCount = result.errors?.length || 0;

          toast({
            title: "Calendar sync complete",
            description: `${pushed} pushed • ${imported} imported${
              errorCount > 0 ? ` • ${errorCount} issues` : ""
            }`,
          });
        }

        if ((result.errors?.length || 0) > 0 && !options?.silent) {
          console.warn("calendar-sync warnings:", result.errors);
        }
      } catch (error: any) {
        if (!options?.silent) {
          toast({
            variant: "destructive",
            title: "Sync failed",
            description: await getCalendarFunctionErrorMessage(error, "sync"),
          });
        }
      } finally {
        setSyncing(false);
      }
    },
    [loadAll, toast, user]
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (loading || autoSynced || !status.hasAnyConnection) return;
    setAutoSynced(true);
    void runSync(undefined, { silent: true });
  }, [autoSynced, loading, runSync, status.hasAnyConnection]);

  useEffect(() => {
    if (!user) return;

    const eventsChannel = supabase
      .channel(`vv-calendar-events-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calendar_events",
        },
        () => {
          void loadEvents();
          void loadCommunityEvents(joinedCircles);
        }
      )
      .subscribe();

    const profileChannel = supabase
      .channel(`vv-calendar-profile-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        async () => {
          const nextCircles = await loadJoinedCircles();
          void loadCommunityEvents(nextCircles);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [joinedCircles, loadCommunityEvents, loadEvents, loadJoinedCircles, user]);

  useEffect(() => {
    const handleResume = () => {
      if (document.visibilityState === "visible") {
        void loadAll();
      }
    };

    window.addEventListener("focus", handleResume);
    document.addEventListener("visibilitychange", handleResume);

    return () => {
      window.removeEventListener("focus", handleResume);
      document.removeEventListener("visibilitychange", handleResume);
    };
  }, [loadAll]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const statusParam = url.searchParams.get("calendar_connect");
    const provider = url.searchParams.get("provider");
    const reason = url.searchParams.get("reason");

    if (!statusParam) return;

    if (statusParam === "success") {
      toast({
        title: "Calendar connected",
        description: `${provider || "Provider"} connected successfully.`,
      });
      void loadAll();
    } else {
      toast({
        variant: "destructive",
        title: "Calendar connection failed",
        description: reason || "Could not connect provider.",
      });
    }

    url.searchParams.delete("calendar_connect");
    url.searchParams.delete("provider");
    url.searchParams.delete("reason");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }, [loadAll, toast]);

  const connectProvider = async (provider: Provider) => {
    setConnectingProvider(provider);
    try {
      const { data, error } = await invokeEdgeFunction(
        "calendar-oauth-start",
        {
          body: {
            provider,
            returnPath: "/calendar",
          },
        },
        { authTransport: "custom" }
      );

      if (error) throw error;
      if (!data?.url) throw new Error("No OAuth URL returned.");

      const oauthUrl = data.url as string;
      const opened = window.open(oauthUrl, "_blank", "noopener,noreferrer");

      if (!opened) {
        window.location.href = oauthUrl;
      }

      toast({
        title: "Continue in browser",
        description: "Finish calendar sign-in in the browser, then return to the app.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: await getCalendarFunctionErrorMessage(error, "connect"),
      });
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleCreateEvent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    const title = form.title.trim();
    if (!title) {
      toast({
        variant: "destructive",
        title: "Title required",
        description: "Add a title for this event.",
      });
      return;
    }

    const startsAt = new Date(form.startsAt);
    const endsAt = new Date(form.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      toast({
        variant: "destructive",
        title: "Invalid date/time",
        description: "Check your event start and end time.",
      });
      return;
    }

    if (endsAt <= startsAt) {
      toast({
        variant: "destructive",
        title: "Invalid time range",
        description: "Event end time must be after start time.",
      });
      return;
    }

    setCreating(true);
    try {
      const { data: insertedRow, error } = await supabase
        .from("calendar_events")
        .insert({
          user_id: user.id,
          title,
          description: form.description.trim() || null,
          location: form.location.trim() || null,
          circle_name: form.circleName || null,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          source: "local",
          sync_state: status.connectedCount > 0 ? "pending" : "synced",
        })
        .select("id")
        .single();

      if (error) throw error;

      setForm(initialCreateForm());
      setActiveTab("planner");
      setCalendarCursorDate(startsAt);
      setSelectedDate(startOfDay(startsAt));
      setPlannerFilter(form.circleName || PLANNER_FILTER_ALL);

      toast({
        title: "Event created",
        description:
          status.connectedCount > 0
            ? "Saved locally. Syncing to connected calendars now."
            : "Saved locally. Connect a calendar to sync externally.",
      });

      await loadEvents();
      await loadCommunityEvents(joinedCircles);

      if (status.connectedCount > 0 && insertedRow?.id) {
        await runSync({ eventId: insertedRow.id }, { silent: true });
        toast({
          title: "Calendar sync complete",
          description: "Your new event was pushed to connected calendars.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not create event",
        description: error?.message || "Please try again.",
      });
    } finally {
      setCreating(false);
    }
  };

  const toEventCardModel = useCallback((event: CalendarEventRow) => {
    const tags = [
      event.circle_name || "Open Community",
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
      title: event.title,
      description: event.description || "No description provided.",
      date: formatEventDate(event.starts_at),
      time: formatEventTimeRange(event.starts_at, event.ends_at),
      location: event.location || "Location TBD",
      attendees: 1,
      maxAttendees: 10,
      tags,
      organizer: "You",
      isAttending: true,
      isOwnedByMe: true,
    };
  }, []);

  const applyTemplate = (template: (typeof EVENT_TEMPLATES)[number]) => {
    setForm((prev) => ({
      ...prev,
      title: template.title,
      description: template.description,
    }));
  };

  const handleInviteEvent = async (event: CalendarEventRow) => {
    const inviteText = [
      `Join me at ${event.title}`,
      `${formatDateTime(event.starts_at)}${event.location ? ` • ${event.location}` : ""}`,
      event.description || "Come hang out with the Violets & Vibes community.",
    ].join("\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: event.title,
          text: inviteText,
        });
        return;
      }

      await navigator.clipboard.writeText(inviteText);
      toast({
        title: "Invite copied",
        description: "The event invite text is ready to share.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not share invite",
        description: error?.message || "Please try again.",
      });
    }
  };

  const startEditingEvent = (event: CalendarEventRow) => {
    if (event.source !== "local") {
      toast({
        variant: "destructive",
        title: "This event cannot be edited here",
        description: "Only local Violets & Vibes events can be edited.",
      });
      return;
    }

    setEditingEventId(event.id);
    setEditingEventForm({
      title: event.title,
      description: event.description || "",
      location: event.location || "",
      startsAt: formatInputDateTime(new Date(event.starts_at)),
      endsAt: formatInputDateTime(new Date(event.ends_at)),
    });
    setActiveTab("events");
  };

  const cancelEditingEvent = () => {
    setEditingEventId(null);
    setEditingEventForm(null);
  };

  const saveEditedEvent = async (event: CalendarEventRow) => {
    if (!user || !editingEventForm || !editingEventId) return;

    const title = editingEventForm.title.trim();
    if (!title) {
      toast({
        variant: "destructive",
        title: "Title required",
        description: "Add a title for this event.",
      });
      return;
    }

    const startsAt = new Date(editingEventForm.startsAt);
    const endsAt = new Date(editingEventForm.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      toast({
        variant: "destructive",
        title: "Invalid date/time",
        description: "Check your event start and end time.",
      });
      return;
    }
    if (endsAt <= startsAt) {
      toast({
        variant: "destructive",
        title: "Invalid time range",
        description: "Event end time must be after start time.",
      });
      return;
    }

    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("calendar_events")
        .update({
          title,
          description: editingEventForm.description.trim() || null,
          location: editingEventForm.location.trim() || null,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          sync_state: status.connectedCount > 0 ? "pending" : "synced",
        })
        .eq("id", editingEventId)
        .eq("user_id", user.id)
        .eq("source", "local");

      if (error) throw error;

      cancelEditingEvent();
      setCalendarCursorDate(startsAt);
      setSelectedDate(startOfDay(startsAt));
      await loadEvents();

      if (status.connectedCount > 0) {
        await runSync({ eventId: event.id }, { silent: true });
      }

      toast({
        title: "Event updated",
        description: "Your edits are now saved.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not update event",
        description: error?.message || "Please try again.",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteEvent = async (event: CalendarEventRow) => {
    if (!user) return;
    if (event.source !== "local") {
      toast({
        variant: "destructive",
        title: "This event cannot be deleted here",
        description: "Only local Violets & Vibes events can be deleted.",
      });
      return;
    }

    const confirmed = window.confirm(
      `Delete "${event.title}"? This removes it from your calendar and Social feed.`
    );
    if (!confirmed) return;

    setDeletingEventId(event.id);
    try {
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", event.id)
        .eq("user_id", user.id)
        .eq("source", "local");

      if (error) throw error;

      if (editingEventId === event.id) {
        cancelEditingEvent();
      }

      await loadEvents();
      await loadCommunityEvents(joinedCircles);

      if (status.connectedCount > 0) {
        await runSync(undefined, { silent: true });
      }

      toast({
        title: "Event deleted",
        description: "The event was removed successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not delete event",
        description: error?.message || "Please try again.",
      });
    } finally {
      setDeletingEventId(null);
    }
  };

  const providerRows: Array<{ key: Provider; name: string }> = [
    { key: "google", name: "Google Calendar" },
    { key: "outlook", name: "Outlook Calendar" },
  ];

  const plannerEvents = useMemo(() => {
    const combined = [...events, ...communityEvents];
    const byId = new Map<string, PlannerEvent>();

    combined.forEach((event) => {
      if (byId.has(event.id)) return;
      const isOwnedByMe = event.user_id === user?.id;
      byId.set(event.id, {
        ...event,
        organizer: isOwnedByMe ? "You" : ownerNamesById[event.user_id] || "Member",
        isOwnedByMe,
        audienceLabel: event.circle_name || "Open Community",
      });
    });

    return Array.from(byId.values()).sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );
  }, [communityEvents, events, ownerNamesById, user?.id]);

  const plannerFilterOptions = useMemo(
    () => [
      { value: PLANNER_FILTER_ALL, label: "All activity" },
      { value: PLANNER_FILTER_MINE, label: "My calendar" },
      { value: PLANNER_FILTER_OPEN, label: "Open community" },
      ...joinedCircles.map((circleName) => ({ value: circleName, label: circleName })),
    ],
    [joinedCircles]
  );

  useEffect(() => {
    if (
      plannerFilter !== PLANNER_FILTER_ALL &&
      plannerFilter !== PLANNER_FILTER_MINE &&
      plannerFilter !== PLANNER_FILTER_OPEN &&
      !joinedCircles.includes(plannerFilter)
    ) {
      setPlannerFilter(PLANNER_FILTER_ALL);
    }
  }, [joinedCircles, plannerFilter]);

  const filteredPlannerEvents = useMemo(() => {
    return plannerEvents.filter((event) => {
      if (plannerFilter === PLANNER_FILTER_ALL) return true;
      if (plannerFilter === PLANNER_FILTER_MINE) return event.isOwnedByMe;
      if (plannerFilter === PLANNER_FILTER_OPEN) return event.source === "local" && !event.circle_name;
      return event.circle_name === plannerFilter;
    });
  }, [plannerEvents, plannerFilter]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return events
      .filter((event) => new Date(event.ends_at).getTime() >= now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [events]);

  const plannerStats = useMemo(() => {
    const upcomingMine = events.filter((event) => new Date(event.ends_at).getTime() >= Date.now()).length;
    const upcomingCircle = communityEvents.filter((event) => !!event.circle_name).length;
    const openCommunity = communityEvents.filter((event) => !event.circle_name).length;

    return {
      upcomingMine,
      upcomingCircle,
      openCommunity,
    };
  }, [communityEvents, events]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarCursorDate));
    const end = endOfWeek(endOfMonth(calendarCursorDate));
    return eachDayOfInterval({ start, end });
  }, [calendarCursorDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(calendarCursorDate);
    const end = endOfWeek(calendarCursorDate);
    return eachDayOfInterval({ start, end });
  }, [calendarCursorDate]);

  const selectedDayEvents = useMemo(
    () => filteredPlannerEvents.filter((event) => eventOccursOnDay(event, selectedDate)),
    [filteredPlannerEvents, selectedDate]
  );

  const agendaEvents = useMemo(
    () =>
      filteredPlannerEvents.filter(
        (event) => parseISO(event.ends_at).getTime() >= startOfDay(calendarCursorDate).getTime()
      ),
    [calendarCursorDate, filteredPlannerEvents]
  );

  const circlePulseEvents = useMemo(() => {
    return plannerEvents
      .filter((event) => !event.isOwnedByMe && event.source === "local")
      .slice(0, 6);
  }, [plannerEvents]);

  const handlePlannerShift = (direction: "prev" | "next") => {
    const delta = direction === "prev" ? -1 : 1;
    const nextDate =
      calendarView === "month"
        ? addMonths(calendarCursorDate, delta)
        : addDays(calendarCursorDate, delta * 7);

    setCalendarCursorDate(nextDate);
    setSelectedDate(startOfDay(nextDate));
  };

  const openCircleConversation = (circleName: string) => {
    navigate(`/chat?circle=${encodeURIComponent(circleName)}`, { replace: false });
  };

  const jumpToEventDay = (event: PlannerEvent) => {
    const start = parseISO(event.starts_at);
    setSelectedDate(startOfDay(start));
    setCalendarCursorDate(start);
    if (event.circle_name) {
      setPlannerFilter(event.circle_name);
    }
  };

  const renderPlannerChip = (event: PlannerEvent, compact = false) => {
    const circleMeta = event.circle_name ? circleByName.get(event.circle_name) : null;
    return (
      <button
        key={event.id}
        type="button"
        onClick={() => jumpToEventDay(event)}
        className={cn(
          "w-full rounded-xl border px-2 py-1.5 text-left transition hover:scale-[1.01] hover:border-white/35",
          compact ? "text-[11px]" : "text-xs",
          event.source === "google" && "border-emerald-300/30 bg-emerald-500/12 text-emerald-50",
          event.source === "outlook" && "border-sky-300/30 bg-sky-500/12 text-sky-50",
          event.source === "local" && !event.circle_name && "border-pink-300/30 bg-pink-500/12 text-pink-50",
          event.source === "local" && !!event.circle_name && "border-violet-300/30 bg-violet-500/14 text-violet-50",
          circleMeta?.glow
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium">{event.title}</span>
          <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-white/55">
            {format(parseISO(event.starts_at), "h:mm a")}
          </span>
        </div>
        {!compact ? (
          <div className="mt-1 truncate text-[11px] text-white/60">
            {event.circle_name || event.organizer}
          </div>
        ) : null}
      </button>
    );
  };

  return (
    <div className="w-full space-y-6 px-0 pb-20 sm:px-1.5 lg:px-2.5 xl:px-3.5 2xl:px-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-6 h-6 text-purple-300" />
          <h2 className="wedding-heading rainbow-header text-2xl">Calendar</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10">
            <Link to="/social">Open Social Events</Link>
          </Button>
          <Button
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            onClick={() => void runSync()}
            disabled={syncing || loading}
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing…
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Now
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PlannerTab)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-violet-950/60 border border-white/15">
          <TabsTrigger value="planner" className="text-white data-[state=active]:bg-violet-600">
            Planner
          </TabsTrigger>
          <TabsTrigger value="events" className="text-white data-[state=active]:bg-violet-600">
            My Events
          </TabsTrigger>
          <TabsTrigger value="create" className="text-white data-[state=active]:bg-violet-600">
            Create Event
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planner" className="mt-4 space-y-4">
          <Card className="overflow-hidden border-white/12 bg-[linear-gradient(135deg,rgba(28,18,60,0.82),rgba(10,18,43,0.9))]">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/55">Preferred calendar view</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(["month", "week", "agenda"] as CalendarViewMode[]).map((view) => (
                      <Button
                        key={view}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setCalendarView(view)}
                        className={cn(
                          "border-white/15 bg-white/5 text-white hover:bg-white/10",
                          calendarView === view && "border-pink-300/35 bg-pink-500/15 text-pink-50"
                        )}
                      >
                        {view === "month" ? "Monthly" : view === "week" ? "Weekly" : "Agenda"}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => handlePlannerShift("prev")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-[200px] rounded-2xl border border-white/12 bg-white/5 px-4 py-2 text-center text-white">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Visible range</div>
                    <div className="text-sm font-medium">{getPlannerRangeLabel(calendarView, calendarCursorDate)}</div>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => handlePlannerShift("next")}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-pink-300/30 bg-pink-500/10 text-pink-50 hover:bg-pink-500/20"
                    onClick={() => {
                      const now = new Date();
                      setCalendarCursorDate(now);
                      setSelectedDate(startOfDay(now));
                    }}
                  >
                    Today
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_280px]">
                <div className="rounded-2xl border border-white/12 bg-black/15 px-4 py-3 text-white/85 text-sm">
                  {calendarView === "month"
                    ? "Month view gives you the full rhythm: your schedule, circle meetups, and open community events in one glance."
                    : calendarView === "week"
                      ? "Week view helps you see how your personal plans and social activity line up day by day."
                      : "Agenda view turns the planner into a live sequence you can act on quickly."}
                </div>

                <select
                  value={plannerFilter}
                  onChange={(event) => setPlannerFilter(event.target.value)}
                  className="h-12 rounded-2xl border border-white/15 bg-white/5 px-3 text-sm text-white"
                >
                  {plannerFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {calendarView === "month" ? (
              <Card className="overflow-hidden border-white/12 bg-[linear-gradient(180deg,rgba(20,18,42,0.96),rgba(10,12,28,0.94))] shadow-[0_24px_80px_rgba(14,12,40,0.32)]">
                <CardContent className="p-1 sm:p-2 lg:p-3">
                  <div className="grid grid-cols-7 gap-0.5 text-[10px] uppercase tracking-[0.1em] text-white/45 sm:gap-1.5 sm:text-[11px] sm:tracking-[0.16em] lg:gap-2">
                    {[
                      { short: "Su", full: "Sun" },
                      { short: "Mo", full: "Mon" },
                      { short: "Tu", full: "Tue" },
                      { short: "We", full: "Wed" },
                      { short: "Th", full: "Thu" },
                      { short: "Fr", full: "Fri" },
                      { short: "Sa", full: "Sat" },
                    ].map((day) => (
                      <div key={day.full} className="px-0.5 py-1 text-center sm:px-1">
                        <span className="sm:hidden">{day.short}</span>
                        <span className="hidden sm:inline">{day.full}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 w-full">
                    <div className="grid w-full grid-cols-7 gap-0.5 sm:gap-1.5 lg:gap-2">
                    {monthDays.map((day) => {
                      const dayEvents = filteredPlannerEvents.filter((event) => eventOccursOnDay(event, day));
                      return (
                        <button
                          key={day.toISOString()}
                          type="button"
                          onClick={() => setSelectedDate(startOfDay(day))}
                          className={cn(
                            "aspect-[1/1.03] min-h-0 rounded-[12px] border p-1 text-left align-top transition sm:aspect-auto sm:min-h-[108px] sm:rounded-[16px] sm:p-1.5 lg:min-h-[138px] lg:p-2 2xl:min-h-[172px]",
                            isSameDay(day, selectedDate)
                              ? "border-pink-300/45 bg-pink-500/10 shadow-[0_0_30px_rgba(236,72,153,0.15)]"
                              : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/7",
                            !isSameMonth(day, calendarCursorDate) && "opacity-45"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-white/90 sm:h-6 sm:w-6 sm:text-xs lg:h-7 lg:w-7 lg:text-sm",
                                isToday(day) && "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white"
                              )}
                            >
                              {format(day, "d")}
                            </span>
                            <span className="hidden text-[9px] uppercase tracking-[0.1em] text-white/40 lg:inline">
                              {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
                            </span>
                          </div>

                          <div className="mt-1 flex min-h-[18px] items-center sm:hidden">
                            {dayEvents.length > 0 ? (
                              <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
                                {dayEvents.length}
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-2 hidden space-y-1.5 sm:mt-2.5 sm:block sm:space-y-1.5 lg:space-y-2">
                            {dayEvents.slice(0, 2).map((event) => renderPlannerChip(event, true))}
                            {dayEvents.length > 2 ? (
                              <div className="rounded-xl border border-dashed border-white/12 px-1.5 py-1 text-[10px] text-white/55 sm:px-2 sm:text-[11px]">
                                +{dayEvents.length - 2} more
                              </div>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {calendarView === "week" ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
                {weekDays.map((day) => {
                  const dayEvents = filteredPlannerEvents.filter((event) => eventOccursOnDay(event, day));
                  return (
                    <Card
                      key={day.toISOString()}
                      className={cn(
                        "border-white/15 bg-black/30",
                        isSameDay(day, selectedDate) && "border-pink-300/40 shadow-[0_0_30px_rgba(236,72,153,0.12)]"
                      )}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <button
                          type="button"
                          onClick={() => setSelectedDate(startOfDay(day))}
                          className="w-full text-left"
                        >
                          <div className="text-[10px] uppercase tracking-[0.14em] text-white/45 sm:text-[11px] sm:tracking-[0.18em]">
                            {format(day, "EEEE")}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-white">
                            <span
                              className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                                isToday(day)
                                  ? "bg-gradient-to-r from-pink-500 to-fuchsia-500"
                                  : "bg-white/10"
                              )}
                            >
                              {format(day, "d")}
                            </span>
                            <span className="text-sm text-white/65">{dayEvents.length} scheduled</span>
                          </div>
                        </button>

                        <div className="mt-4 space-y-2">
                          {dayEvents.length > 0 ? (
                            dayEvents.map((event) => renderPlannerChip(event))
                          ) : (
                            <div className="rounded-xl border border-dashed border-white/12 px-3 py-4 text-xs text-white/45">
                              No events scheduled.
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : null}

            {calendarView === "agenda" ? (
              <div className="space-y-3">
                {agendaEvents.length > 0 ? (
                  agendaEvents.map((event) => {
                    const circleMeta = event.circle_name ? circleByName.get(event.circle_name) : null;
                    return (
                      <Card
                        key={event.id}
                        className={cn("border-white/15 bg-black/30", circleMeta?.glow)}
                      >
                        <CardContent className="p-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={sourceBadgeClass[event.source]} variant="outline">
                                  {event.source}
                                </Badge>
                                <Badge className="border-white/15 bg-white/10 text-white" variant="outline">
                                  {event.audienceLabel}
                                </Badge>
                                <Badge className="border-white/15 bg-white/10 text-white/70" variant="outline">
                                  {event.organizer}
                                </Badge>
                              </div>
                              <div>
                                <div className="text-lg font-semibold text-white">{event.title}</div>
                                <div className="mt-1 text-sm text-white/65">
                                  {formatDateTime(event.starts_at)} • {event.location || "Location TBD"}
                                </div>
                              </div>
                              <p className="text-sm text-white/75">
                                {event.description || "No description provided yet."}
                              </p>
                            </div>

                            <div className="flex flex-col gap-2 lg:w-[220px]">
                              <Button
                                type="button"
                                variant="outline"
                                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                                onClick={() => jumpToEventDay(event)}
                              >
                                Focus this date
                              </Button>
                              {event.circle_name ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="border-violet-300/25 bg-violet-500/10 text-violet-50 hover:bg-violet-500/20"
                                  onClick={() => openCircleConversation(event.circle_name as string)}
                                >
                                  Open circle chat
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="border-pink-300/25 bg-pink-500/10 text-pink-50 hover:bg-pink-500/20"
                                  onClick={() => navigate("/social")}
                                >
                                  Open social feed
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <Card className="border-white/15 bg-black/30">
                    <CardContent className="p-6 text-sm text-white/65">
                      No events match {plannerFilterLabel(plannerFilter, joinedCircles).toLowerCase()} yet.
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,1fr)]">
            <Card className="border-white/12 bg-[linear-gradient(145deg,rgba(23,16,42,0.88),rgba(12,18,42,0.82))]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between gap-3 text-sm text-white">
                  <span>{format(selectedDate, "EEEE, MMMM d")}</span>
                  <Badge className="border-white/15 bg-white/10 text-white" variant="outline">
                    {selectedDayEvents.length} event{selectedDayEvents.length === 1 ? "" : "s"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedDayEvents.length > 0 ? (
                  selectedDayEvents.map((event) => {
                    const circleMeta = event.circle_name ? circleByName.get(event.circle_name) : null;
                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "rounded-2xl border p-4 text-white",
                          event.source === "google" && "border-emerald-300/20 bg-emerald-500/10",
                          event.source === "outlook" && "border-sky-300/20 bg-sky-500/10",
                          event.source === "local" && !event.circle_name && "border-pink-300/20 bg-pink-500/10",
                          event.source === "local" && !!event.circle_name && "border-violet-300/20 bg-violet-500/10",
                          circleMeta?.glow
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-lg font-semibold">{event.title}</div>
                            <div className="mt-1 text-sm text-white/65">
                              {formatEventTimeRange(event.starts_at, event.ends_at)} • {event.location || "Location TBD"}
                            </div>
                          </div>
                          <Badge className={syncBadgeClass[event.sync_state]} variant="outline">
                            {event.sync_state}
                          </Badge>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <Badge className="border-white/15 bg-white/10 text-white" variant="outline">
                            {event.audienceLabel}
                          </Badge>
                          <Badge className={sourceBadgeClass[event.source]} variant="outline">
                            {event.source}
                          </Badge>
                          <Badge className="border-white/15 bg-white/10 text-white/70" variant="outline">
                            {event.organizer}
                          </Badge>
                        </div>

                        <p className="mt-3 text-sm text-white/75">
                          {event.description || "No description provided yet."}
                        </p>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {event.circle_name ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="border-violet-300/25 bg-white/5 text-white hover:bg-white/10"
                              onClick={() => openCircleConversation(event.circle_name as string)}
                            >
                              <MessageCircleMore className="mr-2 h-4 w-4" />
                              Open circle chat
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              className="border-pink-300/25 bg-white/5 text-white hover:bg-white/10"
                              onClick={() => navigate("/social")}
                            >
                              <ArrowRight className="mr-2 h-4 w-4" />
                              Open social feed
                            </Button>
                          )}

                          {event.isOwnedByMe && event.source === "local" ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                              onClick={() => startEditingEvent(event)}
                            >
                              Edit this event
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/12 px-4 py-6 text-sm text-white/55">
                    No events match {plannerFilterLabel(plannerFilter, joinedCircles).toLowerCase()} on this day.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/12 bg-[linear-gradient(145deg,rgba(34,18,58,0.82),rgba(10,18,43,0.8))]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-white">
                  <Users className="h-4 w-4 text-pink-300" />
                  Circle pulse
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {circlePulseEvents.length > 0 ? (
                  circlePulseEvents.map((event) => {
                    const circleMeta = event.circle_name ? circleByName.get(event.circle_name) : null;
                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "rounded-2xl border p-3 text-white",
                          circleMeta?.tone || "border-white/12 bg-white/5",
                          circleMeta?.glow
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{event.title}</div>
                            <div className="mt-1 text-xs text-white/65">
                              {event.circle_name || "Open Community"} • {event.organizer}
                            </div>
                          </div>
                          <Badge className="border-white/15 bg-black/20 text-white" variant="outline">
                            {format(parseISO(event.starts_at), "MMM d")}
                          </Badge>
                        </div>

                        <div className="mt-2 text-xs text-white/65">
                          {formatEventTimeRange(event.starts_at, event.ends_at)}
                          {event.location ? ` • ${event.location}` : ""}
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                            onClick={() => jumpToEventDay(event)}
                          >
                            Show on planner
                          </Button>
                          {event.circle_name ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-violet-300/25 bg-white/5 text-white hover:bg-white/10"
                              onClick={() => openCircleConversation(event.circle_name as string)}
                            >
                              Open circle
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-pink-300/25 bg-white/5 text-white hover:bg-white/10"
                              onClick={() => navigate("/social")}
                            >
                              Social feed
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/12 px-4 py-5 text-sm text-white/55">
                    Join circles on the Social page and their meetups will appear here as they are posted.
                  </div>
                )}

                {communityNotice ? (
                  <div className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/60">
                    {communityNotice}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.15fr)]">
            <Card className="overflow-hidden border-white/12 bg-[linear-gradient(135deg,rgba(34,18,58,0.88),rgba(11,18,40,0.9))]">
              <CardContent className="p-4 sm:p-5">
                <div className="flex h-full flex-col gap-4 lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-pink-300/20 bg-pink-400/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-pink-100">
                      <Sparkles className="h-3.5 w-3.5" />
                      Planner snapshot
                    </div>
                    <h3 className="mt-3 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                      Your calendar stays primary. Circles and social events layer into it.
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm text-white/70">
                      Use month, week, or agenda view without losing your own schedule. Community and circle events stay visible, but secondary to the calendar itself.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-white/50">Your events</div>
                      <div className="mt-1 text-xl font-semibold">{plannerStats.upcomingMine}</div>
                      <div className="text-xs text-white/60">Upcoming on your calendar</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-white/50">Circle meetups</div>
                      <div className="mt-1 text-xl font-semibold">{plannerStats.upcomingCircle}</div>
                      <div className="text-xs text-white/60">From circles you can join or follow</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-white/50">Open community</div>
                      <div className="mt-1 text-xl font-semibold">{plannerStats.openCommunity}</div>
                      <div className="text-xs text-white/60">Shared meetups visible beyond one circle</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid items-start gap-4 xl:grid-cols-[minmax(340px,0.95fr)_minmax(0,1.1fr)]">
              <Card className="h-full bg-black/30 border-white/15">
                <CardContent className="flex h-full flex-col justify-between gap-4 p-4">
                  <div>
                    <div className="text-sm font-semibold text-white">Shared with Social Events</div>
                    <div className="mt-1 text-xs leading-relaxed text-white/65">
                      Events you create here also appear in the Social events UI because both screens use the same calendar event records.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-pink-500/20 text-pink-100 border-pink-300/40">Real-time sync</Badge>
                    <Badge className="bg-white/10 border-white/20 text-white">Calendar + Social + Circles</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/30 border-white/15">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-white flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    Connected Calendars
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {providerRows.map((row) => {
                    const provider = status.providers[row.key];
                    return (
                      <div
                        key={row.key}
                        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-white/95">{row.name}</div>
                          <div className="text-xs text-white/60 truncate">
                            {provider.connected
                              ? provider.providerAccountEmail || "Connected"
                              : "Not connected"}
                          </div>
                        </div>

                        {provider.connected ? (
                          <Badge className="w-fit bg-green-500/20 text-green-100 border-green-300/40">Connected</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full border-violet-300/30 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-white shadow-[0_0_18px_rgba(168,85,247,0.22)] hover:from-violet-500/30 hover:to-fuchsia-500/30 hover:bg-transparent sm:w-auto"
                            onClick={() => void connectProvider(row.key)}
                            disabled={connectingProvider === row.key}
                          >
                            {connectingProvider === row.key ? "Opening..." : "Connect"}
                          </Button>
                        )}
                      </div>
                    );
                  })}

                  <div className="pt-1 flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-xs text-white/60">
                      Apple Calendar uses .ics export. Two-way sync is available for Google and Outlook.
                    </div>
                    <Badge className="bg-white/10 border-white/20 text-white">
                      {status.connectedCount} connected
                    </Badge>
                  </div>

                  {providerStatusNotice ? (
                    <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-50">
                      Provider sync is optional right now. {providerStatusNotice}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-4 mt-4">
          {loading ? (
            <Card className="bg-black/30 border-white/15">
              <CardContent className="p-6 text-white/80 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading events…
              </CardContent>
            </Card>
          ) : upcomingEvents.length === 0 ? (
            <Card className="bg-black/30 border-white/15">
              <CardContent className="p-6 text-white/70">No upcoming events yet.</CardContent>
            </Card>
          ) : (
            upcomingEvents.map((event) => (
              <div key={event.id} className="space-y-2">
                <EventCard
                  event={toEventCardModel(event)}
                  onEdit={event.source === "local" ? () => startEditingEvent(event) : undefined}
                  onDelete={event.source === "local" ? () => void deleteEvent(event) : undefined}
                  actionBusy={deletingEventId === event.id}
                />

                <Card className="bg-black/30 border-white/15">
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 text-sm text-white/80">
                        <Clock className="w-4 h-4 text-pink-300" />
                        <span>{formatDateTime(event.starts_at)}</span>
                      </div>
                      <div className="flex gap-2">
                        {event.circle_name ? (
                          <Badge className="bg-pink-500/20 text-pink-100 border-pink-300/40" variant="outline">
                            {event.circle_name}
                          </Badge>
                        ) : null}
                        <Badge className={sourceBadgeClass[event.source]} variant="outline">
                          {event.source}
                        </Badge>
                        <Badge className={syncBadgeClass[event.sync_state]} variant="outline">
                          {event.sync_state}
                        </Badge>
                      </div>
                    </div>

                    {event.sync_state === "error" && event.sync_error ? (
                      <div className="text-xs text-rose-100 bg-rose-500/15 border border-rose-400/30 rounded-md px-3 py-2 flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{event.sync_error}</span>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      <Button
                        size="sm"
                        className="justify-center bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white shadow-lg shadow-pink-500/20 hover:from-pink-400 hover:to-fuchsia-400"
                        onClick={() => void handleInviteEvent(event)}
                      >
                        <Share2 className="w-3.5 h-3.5 mr-1" />
                        Invite
                      </Button>
                      <Button
                        size="sm"
                        className="justify-center bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-green-500"
                        onClick={() => window.open(buildGoogleUrl(event), "_blank", "noopener,noreferrer")}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        Google
                      </Button>
                      <Button
                        size="sm"
                        className="justify-center bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/20 hover:from-sky-400 hover:to-blue-500"
                        onClick={() => window.open(buildOutlookUrl(event), "_blank", "noopener,noreferrer")}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        Outlook
                      </Button>
                      <Button
                        size="sm"
                        className="justify-center bg-gradient-to-r from-slate-500 to-zinc-700 text-white shadow-lg shadow-slate-500/20 hover:from-slate-400 hover:to-zinc-600"
                        onClick={() => downloadIcs(event)}
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Apple (.ics)
                      </Button>
                    </div>

                    {editingEventId === event.id && editingEventForm ? (
                      <div className="rounded-xl border border-white/15 bg-white/5 p-3 space-y-2">
                        <Input
                          value={editingEventForm.title}
                          onChange={(e) =>
                            setEditingEventForm((prev) =>
                              prev ? { ...prev, title: e.target.value } : prev
                            )
                          }
                          placeholder="Event title"
                        />
                        <Textarea
                          value={editingEventForm.description}
                          onChange={(e) =>
                            setEditingEventForm((prev) =>
                              prev ? { ...prev, description: e.target.value } : prev
                            )
                          }
                          placeholder="Event description"
                          className="min-h-[90px]"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input
                            type="datetime-local"
                            value={editingEventForm.startsAt}
                            onChange={(e) =>
                              setEditingEventForm((prev) =>
                                prev ? { ...prev, startsAt: e.target.value } : prev
                              )
                            }
                          />
                          <Input
                            type="datetime-local"
                            value={editingEventForm.endsAt}
                            onChange={(e) =>
                              setEditingEventForm((prev) =>
                                prev ? { ...prev, endsAt: e.target.value } : prev
                              )
                            }
                          />
                        </div>
                        <Input
                          value={editingEventForm.location}
                          onChange={(e) =>
                            setEditingEventForm((prev) =>
                              prev ? { ...prev, location: e.target.value } : prev
                            )
                          }
                          placeholder="Location"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Button onClick={() => void saveEditedEvent(event)} disabled={savingEdit}>
                            {savingEdit ? "Saving..." : "Save"}
                          </Button>
                          <Button variant="outline" onClick={cancelEditingEvent} disabled={savingEdit}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="create" className="mt-4">
          <Card className="bg-black/30 border-white/15">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-pink-300" />
                Create a New Event
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreateEvent}>
                <div className="space-y-2">
                  <Label htmlFor="event-title" className="text-white/90">
                    Title
                  </Label>
                  <Input
                    id="event-title"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Queer Meetup Night"
                    className="bg-violet-900/30 border-violet-400/30 text-white placeholder:text-white/50"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white/90">Quick start templates</Label>
                  <div className="flex flex-wrap gap-2">
                    {EVENT_TEMPLATES.map((template) => (
                      <Button
                        key={template.label}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                        onClick={() => applyTemplate(template)}
                      >
                        {template.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="event-start" className="text-white/90">
                      Starts
                    </Label>
                    <Input
                      id="event-start"
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(e) => setForm((prev) => ({ ...prev, startsAt: e.target.value }))}
                      className="bg-violet-900/30 border-violet-400/30 text-white"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="event-end" className="text-white/90">
                      Ends
                    </Label>
                    <Input
                      id="event-end"
                      type="datetime-local"
                      value={form.endsAt}
                      onChange={(e) => setForm((prev) => ({ ...prev, endsAt: e.target.value }))}
                      className="bg-violet-900/30 border-violet-400/30 text-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-location" className="text-white/90">
                    Location (optional)
                  </Label>
                  <Input
                    id="event-location"
                    value={form.location}
                    onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="Downtown Community Center"
                    className="bg-violet-900/30 border-violet-400/30 text-white placeholder:text-white/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-circle" className="text-white/90">
                    Circle visibility
                  </Label>
                  <select
                    id="event-circle"
                    value={form.circleName}
                    onChange={(e) => setForm((prev) => ({ ...prev, circleName: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-violet-400/30 bg-violet-900/30 px-3 py-2 text-sm text-white"
                  >
                    <option value="">Open Community</option>
                    {(joinedCircles.length > 0
                      ? communityCircles.filter((circle) => joinedCircles.includes(circle.name))
                      : []
                    ).map((circle) => (
                      <option key={circle.name} value={circle.name}>
                        {circle.name}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-white/55">
                    {joinedCircles.length > 0
                      ? "You can only post calendar events into circles you have joined on the Social page."
                      : "Join a circle on the Social page to target an event to that community. Otherwise the event stays open to the full community."}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-description" className="text-white/90">
                    Description (optional)
                  </Label>
                  <Textarea
                    id="event-description"
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Add event details, expectations, and anything attendees should know."
                    className="bg-violet-900/30 border-violet-400/30 text-white placeholder:text-white/50 min-h-[120px]"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving event…
                    </>
                  ) : (
                    "Create Event"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
};

export default CalendarIntegration;
