import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createServiceClient, requireUser } from "../_shared/supabase.ts";

type ProviderStatus = {
  connected: boolean;
  providerAccountEmail: string | null;
  providerCalendarId: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
};

function safeDecodeJwtExp(token: string | null): { exp: number | null; error?: string } {
  if (!token) return { exp: null, error: "no token" };

  try {
    const parts = token.split(".");
    if (parts.length < 2) {
      return { exp: null, error: "invalid token format" };
    }

    const payload = parts[1];
    const base64 =
      payload.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (payload.length % 4)) % 4);
    const decoded = atob(base64);
    const parsed = JSON.parse(decoded);
    const exp = typeof parsed?.exp === "number" ? parsed.exp : Number(parsed?.exp ?? null);

    return {
      exp: Number.isFinite(exp) ? exp : null,
    };
  } catch (error) {
    return { exp: null, error: String(error) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const now = Math.floor(Date.now() / 1000);
  const url = new URL(req.url);
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const hasAuth = !!authHeader;
  const scheme = hasAuth ? authHeader!.split(" ")[0] ?? null : null;
  const token = hasAuth ? authHeader!.split(" ")[1] ?? null : null;
  const decoded = safeDecodeJwtExp(token);
  const isExpired = decoded.exp ? decoded.exp < now : null;

  console.info("[debug] calendar-status request", {
    method: req.method,
    path: url.pathname,
    hasAuth,
    scheme,
    exp: decoded.exp,
    isExpired,
    decodeError: decoded.error ?? null,
    serverTime: now,
  });

  const { user, errorResponse } = await requireUser(req);
  if (errorResponse || !user) {
    console.warn("[debug] calendar-status auth rejected", {
      method: req.method,
      path: url.pathname,
      hasAuth,
      scheme,
      exp: decoded.exp,
      isExpired,
      decodeError: decoded.error ?? null,
      responseStatus: errorResponse?.status ?? 401,
    });
    return errorResponse!;
  }

  try {
    const service = createServiceClient();
    const { data: rows, error } = await service
      .from("calendar_connections")
      .select("provider, provider_account_email, provider_calendar_id, expires_at, updated_at")
      .eq("user_id", user.id);

    if (error) throw error;

    const providers: Record<"google" | "outlook", ProviderStatus> = {
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

    (rows || []).forEach((row: any) => {
      if (row.provider !== "google" && row.provider !== "outlook") return;
      providers[row.provider] = {
        connected: true,
        providerAccountEmail: row.provider_account_email || null,
        providerCalendarId: row.provider_calendar_id || null,
        expiresAt: row.expires_at || null,
        updatedAt: row.updated_at || null,
      };
    });

    return jsonResponse({
      providers,
      connectedCount: Object.values(providers).filter((p) => p.connected).length,
      hasAnyConnection: Object.values(providers).some((p) => p.connected),
    });
  } catch (error) {
    console.error("calendar-status failed:", error);
    return jsonResponse(
      { error: (error as Error)?.message || "Could not fetch calendar status" },
      500
    );
  }
});
