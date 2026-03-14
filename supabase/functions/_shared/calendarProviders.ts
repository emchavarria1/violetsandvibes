export type Provider = "google" | "outlook";

export type TokenExchangeResult = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
};

export type RemoteEventInput = {
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt: string;
};

export type RemoteEventRow = {
  providerEventId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
};

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

const OUTLOOK_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const OUTLOOK_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const OUTLOOK_ME_URL = "https://graph.microsoft.com/v1.0/me";

const getRequiredEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export function getCallbackUrl() {
  return (
    Deno.env.get("CALENDAR_OAUTH_CALLBACK_URL") ||
    `${getRequiredEnv("SUPABASE_URL")}/functions/v1/calendar-oauth-callback`
  );
}

export function getAppSiteUrl() {
  return Deno.env.get("APP_SITE_URL") || "https://violetsandvibes.com";
}

export function buildAuthorizeUrl(provider: Provider, state: string) {
  const redirectUri = getCallbackUrl();

  if (provider === "google") {
    const clientId = getRequiredEnv("GOOGLE_CALENDAR_CLIENT_ID");
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      scope: "openid email https://www.googleapis.com/auth/calendar.events",
      state,
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  const clientId = getRequiredEnv("OUTLOOK_CALENDAR_CLIENT_ID");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: "offline_access openid profile email Calendars.ReadWrite",
    state,
  });
  return `${OUTLOOK_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  provider: Provider,
  code: string
): Promise<TokenExchangeResult> {
  const redirectUri = getCallbackUrl();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  if (provider === "google") {
    body.set("client_id", getRequiredEnv("GOOGLE_CALENDAR_CLIENT_ID"));
    body.set("client_secret", getRequiredEnv("GOOGLE_CALENDAR_CLIENT_SECRET"));
  } else {
    body.set("client_id", getRequiredEnv("OUTLOOK_CALENDAR_CLIENT_ID"));
    body.set("client_secret", getRequiredEnv("OUTLOOK_CALENDAR_CLIENT_SECRET"));
    body.set("scope", "offline_access openid profile email Calendars.ReadWrite");
  }

  const tokenUrl = provider === "google" ? GOOGLE_TOKEN_URL : OUTLOOK_TOKEN_URL;
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      `OAuth token exchange failed for ${provider}: ${data.error_description || data.error || "unknown"}`
    );
  }

  return data as TokenExchangeResult;
}

export async function refreshAccessToken(
  provider: Provider,
  refreshToken: string
): Promise<TokenExchangeResult> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  if (provider === "google") {
    body.set("client_id", getRequiredEnv("GOOGLE_CALENDAR_CLIENT_ID"));
    body.set("client_secret", getRequiredEnv("GOOGLE_CALENDAR_CLIENT_SECRET"));
  } else {
    body.set("client_id", getRequiredEnv("OUTLOOK_CALENDAR_CLIENT_ID"));
    body.set("client_secret", getRequiredEnv("OUTLOOK_CALENDAR_CLIENT_SECRET"));
    body.set("scope", "offline_access openid profile email Calendars.ReadWrite");
  }

  const tokenUrl = provider === "google" ? GOOGLE_TOKEN_URL : OUTLOOK_TOKEN_URL;
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      `OAuth token refresh failed for ${provider}: ${data.error_description || data.error || "unknown"}`
    );
  }

  return data as TokenExchangeResult;
}

export async function fetchProviderAccountEmail(provider: Provider, accessToken: string) {
  if (provider === "google") {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return (data.email as string | undefined) ?? null;
  }

  const response = await fetch(OUTLOOK_ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const data = await response.json();
  return (data.mail as string | undefined) || (data.userPrincipalName as string | undefined) || null;
}

export async function createOrUpdateRemoteEvent(params: {
  provider: Provider;
  accessToken: string;
  calendarId: string;
  event: RemoteEventInput;
  providerEventId?: string;
}) {
  const { provider, accessToken, calendarId, event, providerEventId } = params;

  if (provider === "google") {
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId || "primary"
    )}/events`;
    const url = providerEventId ? `${base}/${encodeURIComponent(providerEventId)}` : base;

    const response = await fetch(url, {
      method: providerEventId ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.title,
        description: event.description || "",
        location: event.location || "",
        start: { dateTime: new Date(event.startsAt).toISOString() },
        end: { dateTime: new Date(event.endsAt).toISOString() },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        `Google event sync failed: ${data?.error?.message || JSON.stringify(data)}`
      );
    }
    return data.id as string;
  }

  const createBase =
    calendarId && calendarId !== "primary"
      ? `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/events`
      : "https://graph.microsoft.com/v1.0/me/calendar/events";
  const updateBase = "https://graph.microsoft.com/v1.0/me/events";
  const url = providerEventId
    ? `${updateBase}/${encodeURIComponent(providerEventId)}`
    : createBase;

  const response = await fetch(url, {
    method: providerEventId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: event.title,
      body: {
        contentType: "Text",
        content: event.description || "",
      },
      location: { displayName: event.location || "" },
      start: {
        dateTime: new Date(event.startsAt).toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: new Date(event.endsAt).toISOString(),
        timeZone: "UTC",
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      `Outlook event sync failed: ${data?.error?.message || JSON.stringify(data)}`
    );
  }
  return data.id as string;
}

export async function listRemoteEvents(params: {
  provider: Provider;
  accessToken: string;
  calendarId: string;
  startAt: string;
  endAt: string;
}) {
  const { provider, accessToken, calendarId, startAt, endAt } = params;

  if (provider === "google") {
    const listUrl = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId || "primary"
      )}/events`
    );
    listUrl.searchParams.set("singleEvents", "true");
    listUrl.searchParams.set("orderBy", "startTime");
    listUrl.searchParams.set("timeMin", new Date(startAt).toISOString());
    listUrl.searchParams.set("timeMax", new Date(endAt).toISOString());
    listUrl.searchParams.set("maxResults", "250");

    const response = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        `Google calendar read failed: ${data?.error?.message || JSON.stringify(data)}`
      );
    }

    const rows: RemoteEventRow[] = (data.items || [])
      .map((item: Record<string, unknown>) => {
        const start = (item.start as Record<string, unknown>) || {};
        const end = (item.end as Record<string, unknown>) || {};
        const startIso = (start.dateTime as string) || (start.date as string);
        const endIso = (end.dateTime as string) || (end.date as string);

        if (!item.id || !startIso || !endIso) return null;

        return {
          providerEventId: String(item.id),
          title: String(item.summary || "Untitled Event"),
          description: (item.description as string | undefined) || null,
          location: (item.location as string | undefined) || null,
          startsAt: new Date(startIso).toISOString(),
          endsAt: new Date(endIso).toISOString(),
        };
      })
      .filter((row: RemoteEventRow | null): row is RemoteEventRow => !!row);

    return rows;
  }

  const basePath =
    calendarId && calendarId !== "primary"
      ? `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/calendarView`
      : "https://graph.microsoft.com/v1.0/me/calendarview";
  const listUrl = new URL(basePath);
  listUrl.searchParams.set("startDateTime", new Date(startAt).toISOString());
  listUrl.searchParams.set("endDateTime", new Date(endAt).toISOString());
  listUrl.searchParams.set("$top", "250");
  listUrl.searchParams.set("$orderby", "start/dateTime");

  const response = await fetch(listUrl.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      `Outlook calendar read failed: ${data?.error?.message || JSON.stringify(data)}`
    );
  }

  const rows: RemoteEventRow[] = (data.value || [])
    .map((item: Record<string, unknown>) => {
      const start = (item.start as Record<string, unknown>) || {};
      const end = (item.end as Record<string, unknown>) || {};
      const startIso = start.dateTime as string | undefined;
      const endIso = end.dateTime as string | undefined;

      if (!item.id || !startIso || !endIso) return null;

      const body = (item.body as Record<string, unknown>) || {};
      const location = (item.location as Record<string, unknown>) || {};

      return {
        providerEventId: String(item.id),
        title: String(item.subject || "Untitled Event"),
        description: (body.content as string | undefined) || null,
        location: (location.displayName as string | undefined) || null,
        startsAt: new Date(startIso).toISOString(),
        endsAt: new Date(endIso).toISOString(),
      };
    })
    .filter((row: RemoteEventRow | null): row is RemoteEventRow => !!row);

  return rows;
}
