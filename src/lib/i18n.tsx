import React, { createContext, useContext, useMemo } from "react";

type SupportedLocale = "en" | "es";

type TranslationValue =
  | string
  | ((vars?: Record<string, string | number | boolean | undefined>) => string);

type TranslationDictionary = Record<string, TranslationValue>;

const translations: Record<SupportedLocale, TranslationDictionary> = {
  en: {
    discover: "Discover",
    matches: "Matches",
    chat: "Chat",
    alerts: "Alerts",
    social: "Social",
    calendar: "Calendar",
    profile: "Profile",
    messages: "Messages",
    events: "Events",
    safetyScore: "Safety Score",
    reportUser: "Report User",
    createPost: "Create Post",
    joinCircle: "Join Circle",
    openCircle: "Open Circle",
    inviteFriends: "Invite Friends",
    inviteFriend: "Invite a friend",
    inviteFriendsToGrowThisCircle: "Invite friends to grow this circle",
    inviteFriendToAttendWithYou: "Invite a friend to attend with you",
    joinEvent: "Join Event",
    attending: "Attending",
    shareBadge: "Share badge",
    communityCircles: "Community Circles",
    datingFriendshipCommunity: "Dating + friendship + community",
    communityCirclesDescription:
      "Circles keep people engaged even when they do not match quickly. Each circle blends posts, meetups, chats, and member lists so the app keeps momentum through real community.",
    createCircle: "Create a Circle",
    suggestCircle: "Suggest a Circle",
    browseAllCircles: "Browse all Circles",
    suggestCircleHelp:
      "Suggest ideas like Women in Tech, Divorced & Rebuilding, or Dog Moms. Admins and moderators review suggestions before they go live.",
    suggestCircleIdea: "Suggest a circle idea",
    optionalNoteForModerators: "Optional note for moderators",
    submitting: "Submitting...",
    submitIdea: "Submit idea",
    signInToSubmitCircleSuggestion: "Sign in to submit a circle suggestion.",
    trendingCircles: "Trending Circles",
    allCircles: "All Circles",
    circle: "Circle",
    chats: "Chats",
    meetups: "Meetups",
    posts: "Posts",
    memberList: "Member list",
    members: "members",
    newPostsToday: ({ count }) => `${count} new post${count === 1 ? "" : "s"} today`,
    activeChats: ({ count }) => `${count} active chats`,
  },
  es: {
    discover: "Descubrir",
    matches: "Matches",
    chat: "Chat",
    alerts: "Alertas",
    social: "Social",
    calendar: "Calendario",
    profile: "Perfil",
    messages: "Mensajes",
    events: "Eventos",
    safetyScore: "Puntuacion de seguridad",
    reportUser: "Reportar usuario",
    createPost: "Crear publicacion",
    joinCircle: "Unirse al circulo",
    openCircle: "Abrir circulo",
    inviteFriends: "Invitar amigas",
    inviteFriend: "Invitar a una amiga",
    inviteFriendsToGrowThisCircle: "Invita amigas para hacer crecer este circulo",
    inviteFriendToAttendWithYou: "Invita a una amiga a asistir contigo",
    joinEvent: "Unirse al evento",
    attending: "Asistire",
    shareBadge: "Compartir insignia",
    communityCircles: "Circulos comunitarios",
    datingFriendshipCommunity: "Citas + amistad + comunidad",
    communityCirclesDescription:
      "Los circulos mantienen a las personas activas incluso cuando no hacen match rapido. Cada circulo combina publicaciones, encuentros, chats y listas de miembros para que la app mantenga impulso con comunidad real.",
    createCircle: "Crear un circulo",
    suggestCircle: "Sugerir un circulo",
    browseAllCircles: "Ver todos los circulos",
    suggestCircleHelp:
      "Sugiere ideas como Mujeres en tecnologia, Divorciadas y reconstruyendo su vida, o Dog Moms. Administradoras y moderadoras revisan las sugerencias antes de publicarlas.",
    suggestCircleIdea: "Sugiere una idea de circulo",
    optionalNoteForModerators: "Nota opcional para moderadoras",
    submitting: "Enviando...",
    submitIdea: "Enviar idea",
    signInToSubmitCircleSuggestion: "Inicia sesion para sugerir un circulo.",
    trendingCircles: "Circulos en tendencia",
    allCircles: "Todos los circulos",
    circle: "Circulo",
    chats: "Chats",
    meetups: "Encuentros",
    posts: "Publicaciones",
    memberList: "Lista de miembros",
    members: "miembros",
    newPostsToday: ({ count }) => `${count} publicacion${count === 1 ? "" : "es"} nueva${count === 1 ? "" : "s"} hoy`,
    activeChats: ({ count }) => `${count} chats activos`,
  },
};

const detectLocale = (): SupportedLocale => {
  if (typeof navigator === "undefined") return "en";

  const preferredLocales = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  const hasSpanish = preferredLocales.some((locale) =>
    locale?.toLowerCase().startsWith("es"),
  );

  return hasSpanish ? "es" : "en";
};

type I18nContextValue = {
  locale: SupportedLocale;
  t: (key: string, vars?: Record<string, string | number | boolean | undefined>) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const locale = useMemo(() => detectLocale(), []);

  const value = useMemo<I18nContextValue>(() => {
    const t = (
      key: string,
      vars?: Record<string, string | number | boolean | undefined>,
    ): string => {
      const translation = translations[locale][key] ?? translations.en[key] ?? key;
      return typeof translation === "function" ? translation(vars) : translation;
    };

    return { locale, t };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }

  return context;
};
