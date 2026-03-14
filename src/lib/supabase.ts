import { createClient, type Session } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

type EdgeInvokeOptions = NonNullable<Parameters<typeof supabase.functions.invoke>[1]>;

type EdgeInvokeAuthOptions = {
  requireAuth?: boolean;
  forceRefresh?: boolean;
  includeAccessTokenInBody?: boolean;
};

const SESSION_REFRESH_BUFFER_SECONDS = 60;

const isPlainObjectBody = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") return false;
  if (value instanceof FormData) return false;
  if (value instanceof Blob) return false;
  if (value instanceof ArrayBuffer) return false;
  if (ArrayBuffer.isView(value)) return false;
  return Object.prototype.toString.call(value) === "[object Object]";
};

const sessionNeedsRefresh = (session: Session | null) => {
  if (!session?.access_token) return true;
  if (!session.refresh_token) return false;

  const expiresAt = session.expires_at ?? 0;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return expiresAt <= nowInSeconds + SESSION_REFRESH_BUFFER_SECONDS;
};

export async function getFreshSession(options?: { forceRefresh?: boolean }) {
  const forceRefresh = options?.forceRefresh ?? false;

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session) {
    return null;
  }

  if (!forceRefresh && !sessionNeedsRefresh(session)) {
    return session;
  }

  if (!session.refresh_token) {
    return session;
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    throw refreshError;
  }

  return refreshed.session ?? null;
}

export async function getFreshAccessToken(options?: { forceRefresh?: boolean }) {
  const session = await getFreshSession(options);
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error("Unauthorized");
  }

  return accessToken;
}

export async function invokeEdgeFunction<TData = unknown>(
  functionName: string,
  options: EdgeInvokeOptions = {},
  authOptions: EdgeInvokeAuthOptions = {}
) {
  const {
    requireAuth = true,
    forceRefresh = false,
    includeAccessTokenInBody = false,
  } = authOptions;

  let accessToken: string | null = null;

  if (requireAuth) {
    accessToken = await getFreshAccessToken({ forceRefresh });
  } else {
    try {
      accessToken = await getFreshAccessToken({ forceRefresh });
    } catch {
      accessToken = null;
    }
  }

  let body = options.body;
  if (accessToken && includeAccessTokenInBody) {
    if (isPlainObjectBody(body)) {
      body = { ...body, accessToken };
    } else if (body == null) {
      body = { accessToken };
    }
  }

  const headers = {
    ...(options.headers ?? {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  return supabase.functions.invoke<TData>(functionName, {
    ...options,
    body,
    headers,
  });
}
