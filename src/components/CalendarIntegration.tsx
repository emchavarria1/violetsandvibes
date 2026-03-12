import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  Share2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import EventCard from "./EventCard";
import { communityCircles } from "./CommunityCirclesCard";
import { Link } from "react-router-dom";

type Provider = "google" | "outlook";

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

type CreateEventForm = {
  title: string;
  description: string;
  location: string;
  circleName: string;
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

const getCalendarFunctionErrorMessage = (error: unknown, action: "connect" | "sync" | "status") => {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const normalized = rawMessage.toLowerCase();

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

const CalendarIntegration: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [status, setStatus] = useState<CalendarStatusResponse>({
    providers: defaultProviderStatus,
    connectedCount: 0,
    hasAnyConnection: false,
  });
  const [events, setEvents] = useState<CalendarEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<Provider | null>(null);
  const [form, setForm] = useState<CreateEventForm>(initialCreateForm);
  const [autoSynced, setAutoSynced] = useState(false);
  const [joinedCircles, setJoinedCircles] = useState<string[]>([]);

  const loadStatus = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("calendar-status");
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
  }, []);

  const loadJoinedCircles = useCallback(async () => {
    if (!user?.id) {
      setJoinedCircles([]);
      return;
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
    if (Array.isArray(stored)) {
      setJoinedCircles(stored.filter((value): value is string => typeof value === "string"));
    } else {
      setJoinedCircles([]);
    }
  }, [user?.id]);

  const loadEvents = useCallback(async () => {
    if (!user) {
      setEvents([]);
      return;
    }

    const { data, error } = await supabase
      .from("calendar_events")
      .select(
        "id, title, description, location, circle_name, starts_at, ends_at, source, source_event_id, sync_state, sync_error, created_at"
      )
      .eq("user_id", user.id)
      .order("starts_at", { ascending: true })
      .limit(500);

    if (error) throw error;
    setEvents((data || []) as CalendarEventRow[]);
  }, [user]);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await Promise.all([loadStatus(), loadEvents(), loadJoinedCircles()]);
    } catch (error) {
      console.error("Failed to load calendar integration:", error);
      toast({
        variant: "destructive",
        title: "Calendar unavailable",
        description: getCalendarFunctionErrorMessage(error, "status"),
      });
    } finally {
      setLoading(false);
    }
  }, [loadEvents, loadJoinedCircles, loadStatus, toast, user]);

  const runSync = useCallback(
    async (payload?: Record<string, unknown>, options?: { silent?: boolean }) => {
      if (!user) return;

      setSyncing(true);
      try {
        const { data, error } = await supabase.functions.invoke("calendar-sync", {
          body: payload || {},
        });

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
            description: getCalendarFunctionErrorMessage(error, "sync"),
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

    const channel = supabase
      .channel(`vv-calendar-${user.id}`)
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
      const { data, error } = await supabase.functions.invoke("calendar-oauth-start", {
        body: {
          provider,
          returnPath: "/calendar",
        },
      });

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
        description: getCalendarFunctionErrorMessage(error, "connect"),
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
      toast({
        title: "Event created",
        description: status.connectedCount > 0
          ? "Saved locally. Syncing to connected calendars now."
          : "Saved locally. Connect a calendar to sync externally.",
      });

      await loadEvents();

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

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return events
      .filter((event) => new Date(event.ends_at).getTime() >= now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [events]);

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

  const providerRows: Array<{ key: Provider; name: string }> = [
    { key: "google", name: "Google Calendar" },
    { key: "outlook", name: "Outlook Calendar" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-20">
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

      <Card className="bg-black/30 border-white/15">
        <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Shared with Social Events</div>
            <div className="text-xs text-white/65">
              Events you create here also appear in the Social events UI because both screens use the same calendar event records.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-pink-500/20 text-pink-100 border-pink-300/40">Real-time sync</Badge>
            <Badge className="bg-white/10 border-white/20 text-white">Calendar + Social</Badge>
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
        </CardContent>
      </Card>

      <Tabs defaultValue="events" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-violet-950/60 border border-white/15">
          <TabsTrigger value="events" className="text-white data-[state=active]:bg-violet-600">
            Upcoming Events
          </TabsTrigger>
          <TabsTrigger value="create" className="text-white data-[state=active]:bg-violet-600">
            Create Event
          </TabsTrigger>
        </TabsList>

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
                <EventCard event={toEventCardModel(event)} />

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
                      <Button size="sm" variant="outline" onClick={() => void handleInviteEvent(event)}>
                        <Share2 className="w-3.5 h-3.5 mr-1" />
                        Invite
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(buildGoogleUrl(event), "_blank", "noopener,noreferrer")}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        Google
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(buildOutlookUrl(event), "_blank", "noopener,noreferrer")}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        Outlook
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => downloadIcs(event)}>
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Apple (.ics)
                      </Button>
                    </div>
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
                    {(joinedCircles.length > 0 ? communityCircles.filter((circle) => joinedCircles.includes(circle.name)) : []).map((circle) => (
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
