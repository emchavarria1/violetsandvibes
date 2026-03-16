export const COMMUNITY_GUIDE_CONVERSATION_ID = "community-guide";

export type CommunityGuideMessage = {
  id: string;
  role: "guide" | "user";
  body: string;
  createdAt: string;
};

const QUICK_REPLY_RULES: Array<{
  match: string[];
  reply: string;
}> = [
  {
    match: ["verify", "verification", "id", "photo"],
    reply:
      "Verification lives under Verify. If you finish that flow, the rest of the app opens up more cleanly and your safety score improves.",
  },
  {
    match: ["event", "calendar", "meetup"],
    reply:
      "Use Calendar for your own planning and Social Events for community-facing meetups. Circle events can stay private to a circle or be shared wider.",
  },
  {
    match: ["circle", "community", "social"],
    reply:
      "Circles work best when you join one that already matches your energy. Open Social, pick a circle, then the related chat becomes available.",
  },
  {
    match: ["match", "matches", "like", "dating"],
    reply:
      "Discover is for browsing. Matches and direct conversations only work with real profiles, not the demo seed profiles you see in local demo mode.",
  },
  {
    match: ["safe", "safety", "report", "block"],
    reply:
      "If something feels off, block first and report second. The app already routes those controls through the profile and chat safety flows.",
  },
];

const DEFAULT_GUIDE_MESSAGES = (displayName?: string): CommunityGuideMessage[] => {
  const now = new Date();
  const name = displayName?.trim() || "there";

  return [
    {
      id: "guide-welcome",
      role: "guide",
      body: `I’m the Community Guide. I’m a system assistant, not a real member. I can point you to Discover, Social, Calendar, and Verification without pretending to be a person.`,
      createdAt: new Date(now.getTime() - 1000 * 60 * 6).toISOString(),
    },
    {
      id: "guide-orientation",
      role: "guide",
      body: `Welcome, ${name}. Start with Discover if you want profiles, Social if you want circles and posts, and Calendar if you want events and meetup planning.`,
      createdAt: new Date(now.getTime() - 1000 * 60 * 4).toISOString(),
    },
    {
      id: "guide-prompt",
      role: "guide",
      body:
        "Ask me where to go next, or use the quick links below. I keep guidance explicit so demo and real-member activity never get mixed together.",
      createdAt: new Date(now.getTime() - 1000 * 60 * 2).toISOString(),
    },
  ];
};

function getStorageKey(userId: string) {
  return `vv_community_guide_thread_${userId}`;
}

function safeParseMessages(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((entry) => entry && typeof entry === "object")
      .map((entry: any) => ({
        id: typeof entry.id === "string" ? entry.id : `guide-${Date.now()}`,
        role: entry.role === "user" ? "user" : "guide",
        body: typeof entry.body === "string" ? entry.body : "",
        createdAt:
          typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
      }))
      .filter((entry) => entry.body.trim().length > 0) as CommunityGuideMessage[];
  } catch {
    return null;
  }
}

export function loadCommunityGuideThread(userId: string, displayName?: string) {
  const defaults = DEFAULT_GUIDE_MESSAGES(displayName);
  if (typeof window === "undefined") return defaults;

  const parsed = safeParseMessages(window.localStorage.getItem(getStorageKey(userId)));
  if (parsed && parsed.length > 0) return parsed;

  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(defaults));
  return defaults;
}

export function persistCommunityGuideThread(userId: string, thread: CommunityGuideMessage[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(thread));
}

function chooseGuideReply(message: string) {
  const normalized = message.toLowerCase();
  const matchedRule = QUICK_REPLY_RULES.find((rule) =>
    rule.match.some((needle) => normalized.includes(needle))
  );
  if (matchedRule) return matchedRule.reply;

  return "I can help with Discover, circles, events, verification, and safety controls. If you want, ask me where a feature lives and I’ll point you there directly.";
}

export function appendCommunityGuideExchange(
  userId: string,
  existingThread: CommunityGuideMessage[],
  userMessage: string
) {
  const trimmed = userMessage.trim();
  if (!trimmed) return existingThread;

  const userEntry: CommunityGuideMessage = {
    id: `guide-user-${Date.now()}`,
    role: "user",
    body: trimmed,
    createdAt: new Date().toISOString(),
  };

  const guideEntry: CommunityGuideMessage = {
    id: `guide-reply-${Date.now() + 1}`,
    role: "guide",
    body: chooseGuideReply(trimmed),
    createdAt: new Date(Date.now() + 1000).toISOString(),
  };

  const nextThread = [...existingThread, userEntry, guideEntry];
  persistCommunityGuideThread(userId, nextThread);
  return nextThread;
}
