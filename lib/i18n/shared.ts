import { AUTO_TRANSLATIONS } from "./translations.auto";

export type Locale =
  | "en"
  | "uk"
  | "de"
  | "fr"
  | "it"
  | "es"
  | "sv"
  | "fi"
  | "no"
  | "da"
  | "cs"
  | "pl"
  | "sk"
  | "hu"
  | "ro"
  | "el"
  | "hr"
  | "me";

export type TranslateParams = Record<string, string | number>;

export const DEFAULT_LOCALE: Locale = "en";
const COOKIE_LOCALE_KEY = "kv_lang";

export const SUPPORTED_LOCALES: Array<{ value: Locale; label: string }> = [
  { value: "en", label: "English" },
  { value: "uk", label: "Українська" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "it", label: "Italiano" },
  { value: "es", label: "Español" },
  { value: "sv", label: "Svenska" },
  { value: "fi", label: "Suomi" },
  { value: "no", label: "Norsk" },
  { value: "da", label: "Dansk" },
  { value: "cs", label: "Čeština" },
  { value: "pl", label: "Polski" },
  { value: "sk", label: "Slovenčina" },
  { value: "hu", label: "Magyar" },
  { value: "ro", label: "Română" },
  { value: "el", label: "Ελληνικά" },
  { value: "hr", label: "Hrvatski" },
  { value: "me", label: "Crnogorski" }
];

const BASE_MESSAGES: Record<string, string> = {
  "lang.label": "Language",
  "lang.switch": "Switch language",

  "nav.home": "Home",
  "nav.watchlist": "Watchlist",
  "nav.search": "Search",
  "nav.signIn": "Sign in",
  "nav.signOut": "Sign out",
  "nav.profile": "Profile",
  "nav.backHome": "Back home",
  "nav.analytics": "Analytics",
  "nav.auditLogs": "Audit logs",

  "theme.switchToLight": "Switch to light theme",
  "theme.switchToDark": "Switch to dark theme",
  "theme.lightMode": "Light mode",
  "theme.darkMode": "Dark mode",

  "home.featuredTonight": "Featured tonight",
  "home.watchTrailer": "Watch trailer",
  "home.addToWatchlist": "Add to watchlist",
  "home.browseGenres": "Browse genres",
  "home.trendingNow": "Trending now",
  "home.trendingCaption": "Fresh picks from the community this week",
  "home.continueWatching": "Continue watching",
  "home.topPicks": "Top picks for you",
  "home.topPicksCaption": "From top-rated titles and your library preferences",
  "home.continueCaptionSynced": "Synced from your KinoVibe profile in Supabase.",
  "home.continueCaptionPopular": "Popular now. Sign in to sync progress from Supabase.",
  "home.continueCaptionFallback": "Sample data. Connect Supabase and TMDB to personalize this rail.",
  "home.searchPlaceholder": "Find by title, actor, or genre",
  "home.searchLabel": "Search movies",
  "home.progressEmpty": "Sign in to sync your watch progress.",
  "home.trendingEmpty": "Trending titles are temporarily unavailable.",
  "home.topPicksEmpty": "Top picks will appear after data sync.",
  "home.logoAria": "KinoVibe home",
  "home.openWatchlistAria": "Open watchlist",
  "home.signInAria": "Sign in to KinoVibe",
  "home.browseGenreAria": "Browse {genre} movies",
  "home.mobileNavAria": "Bottom navigation",
  "home.details": "Details",
  "home.noTitlesFound": "No titles found.",
  "home.defaultGenre": "Cinema",
  "home.runtimeTbd": "Runtime TBD",
  "home.fallbackOverview": "Discover trending films, save your picks, and build a cinematic watch rhythm tailored to your taste.",
  "home.progressAria": "{progress}% watched",
  "home.lastUpdated": "Last updated: {time}",

  "auth.verifyBanner": "Your email is not verified yet. Verify to secure your account and keep watchlist sync reliable.",
  "auth.verifyEmail": "Verify email",
  "auth.welcome": "Welcome to KinoVibe",
  "auth.welcomeSubtitle": "Sign in to sync your watchlist, update progress, and unlock personalized rails based on your activity.",
  "auth.callbackFailed": "The auth callback failed or expired. Try signing in again.",
  "auth.configMissing": "Supabase auth is not configured for this environment.",
  "auth.signInHint": "Use your existing KinoVibe account.",
  "auth.continueGoogle": "Continue with Google",
  "auth.redirecting": "Redirecting...",
  "auth.needVerify": "Need to verify your email?",
  "auth.openVerifyHelp": "Open verification help",
  "auth.createAccount": "Create account",
  "auth.createAccountHint": "Start syncing your watchlist across sessions.",
  "auth.creatingAccount": "Creating account...",
  "auth.forgotPassword": "Forgot password",
  "auth.forgotPasswordHint": "Send a secure reset link to your email.",
  "auth.sendResetLink": "Send reset link",
  "auth.signingIn": "Signing in...",
  "auth.emailAndPasswordRequired": "Email and password are required.",
  "auth.passwordMin": "Password must be at least 8 characters.",
  "auth.supabaseMissing": "Supabase is not configured.",
  "auth.signInFailed": "Could not sign in.",
  "auth.createFailed": "Could not create account.",
  "auth.googleStartFailed": "Could not start Google sign-in.",
  "auth.emailRequired": "Email is required.",
  "auth.resetEmailSent": "Password reset email sent. Open the link in your inbox.",
  "auth.resetEmailFailed": "Could not send reset email.",
  "auth.resendEmailSent": "Verification email sent. Check your inbox.",
  "auth.resendFailed": "Could not resend verification email.",
  "auth.passwordFieldsRequired": "Both password fields are required.",
  "auth.passwordMismatch": "Passwords do not match.",
  "auth.passwordUpdated": "Password updated.",
  "auth.passwordUpdateFailed": "Could not update password.",
  "auth.resetTitle": "Reset your password",
  "auth.resetSubtitle": "Securely set a new password for your KinoVibe account.",
  "auth.resetAccount": "Account",
  "auth.resetSessionLabel": "Authenticated session",
  "auth.resetSetNewPassword": "Set new password",
  "auth.resetHint": "Choose a strong password with at least 8 characters.",
  "auth.resetUpdating": "Updating...",
  "auth.verifyBack": "Back to sign in",
  "auth.verifyInboxTitle": "Check your inbox",
  "auth.verifyInboxHint": "Verification emails can take a minute. Also check spam or promotions if you do not see it.",
  "auth.verifyTitle": "Verify your email",
  "auth.verifySent": "We sent a confirmation link to {email}. Open that link to activate your account.",
  "auth.verifyFallbackEmail": "your email address",
  "auth.verifyResend": "Resend verification email",

  "profile.title": "Profile settings",
  "profile.subtitle": "Manage your account details and security.",
  "profile.firstName": "First name",
  "profile.lastName": "Last name",
  "profile.website": "Website",
  "profile.country": "Country",
  "profile.save": "Save profile",
  "profile.passwordTitle": "Change password",
  "profile.newPassword": "New password",
  "profile.confirmPassword": "Confirm password",
  "profile.updatePassword": "Update password",
  "profile.securityHint": "Use at least 8 characters.",
  "profile.updated": "Profile updated.",
  "profile.invalidWebsite": "Website URL is invalid.",
  "profile.unauthorized": "Unauthorized.",
  "profile.supabaseMissing": "Supabase is not configured.",
  "profile.updateFailed": "Could not update profile: {reason}",
  "profile.passwordUpdateFailed": "Could not update password: {reason}",

  "analytics.title": "Visitor analytics",
  "analytics.subtitle": "Traffic, clicks, and movie-add events from site activity.",
  "analytics.countries": "Countries",
  "analytics.ips": "IP addresses",
  "analytics.pages": "Top pages",
  "analytics.clicks": "Top clicks",
  "analytics.movies": "Movies added",
  "analytics.visits": "Visits",
  "analytics.events": "Events",
  "analytics.queryFailed": "Query failed",

  "admin.accessDenied": "Access denied",
  "admin.adminRequired": "Admin access required.",
  "admin.supabaseUnavailable": "Supabase unavailable",
  "admin.configureSupabase": "Configure Supabase credentials before loading this page.",
  "admin.auditTitle": "Audit logs",
  "admin.auditSubtitleServiceRole": "Service-role mode: full visibility across users.",
  "admin.auditSubtitleFallback": "Fallback mode: set SUPABASE_SERVICE_ROLE_KEY for full cross-user visibility.",
  "admin.exportCsv": "Export CSV",
  "admin.retention": "Retention",
  "admin.retentionHint": "Delete logs older than a chosen number of days.",
  "admin.daysToKeep": "Days to keep",
  "admin.purging": "Purging...",
  "admin.applyRetention": "Apply retention",
  "admin.routeKey": "Route key",
  "admin.outcome": "Outcome",
  "admin.statusCode": "Status code",
  "admin.userId": "User ID",
  "admin.optionalUuid": "optional uuid",
  "admin.applyFilters": "Apply filters",
  "admin.time": "Time",
  "admin.route": "Route",
  "admin.user": "User",
  "admin.status": "Status",
  "admin.ip": "IP",
  "admin.metadata": "Metadata",
  "admin.noAuditEntries": "No audit entries for current filters.",
  "admin.auditPaginationAria": "Audit pagination",
  "admin.records": "records",
  "admin.retentionRange": "Retention must be between 1 and 3650 days.",
  "admin.retentionFailed": "Retention cleanup failed: {reason}",
  "admin.retentionComplete": "Retention cleanup complete for logs older than {days} day(s).{deleted}",
  "admin.deletedRows": " Deleted {count} row(s).",
  "admin.unknownError": "unknown error",

  "common.email": "Email",
  "common.password": "Password",
  "common.previous": "Previous",
  "common.next": "Next",
  "common.page": "Page",
  "common.of": "of",
  "common.sending": "Sending...",
  "common.updating": "Updating...",
  "common.saving": "Saving...",
  "common.pleaseTryAgain": "Please try again.",
  "common.notAvailable": "n/a",

  "search.placeholder": "Search by title, actor, or keyword",
  "search.aria": "Search movies",
  "search.resultsFor": "results for",
  "search.startHint": "Type a movie title to start exploring.",
  "search.noMatches": "No matches found",
  "search.noMatchesHint": "Try a shorter title, alternate spelling, or broader keyword.",
  "search.anotherMovie": "Search another movie",
  "search.resultsAria": "Search results",
  "search.paginationAria": "Pagination",

  "watchlist.title": "My Watchlist",
  "watchlist.account": "Your account",
  "watchlist.savedTitles": "saved titles",
  "watchlist.loadError": "Could not load watchlist",
  "watchlist.emptyTitle": "No saved titles yet",
  "watchlist.emptyHint": "Open search or any movie page and add your first title.",
  "watchlist.findMovies": "Find movies",
  "watchlist.emptySection": "No titles in this section yet.",
  "watchlist.supabaseMissing": "Supabase not configured",
  "watchlist.supabaseHint": "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then refresh.",
  "watchlist.signInHint": "Sign in to save this movie to your watchlist and track progress.",
  "watchlist.inWatchlist": "In watchlist",
  "watchlist.notInWatchlist": "Not in watchlist",
  "watchlist.statusLabel": "Status",
  "watchlist.progress": "Progress",
  "watchlist.saveProgress": "Save progress",
  "watchlist.markWatching": "Mark watching",
  "watchlist.markWatched": "Mark watched",
  "watchlist.remove": "Remove",
  "watchlist.status.toWatch": "To Watch",
  "watchlist.status.watching": "Watching",
  "watchlist.status.watched": "Watched",
  "watchlist.tba": "TBA",
  "watchlist.addToTrack": "Add this title to start tracking progress.",
  "watchlist.synced": "Synced with your watchlist.",
  "watchlist.updated": "Watchlist updated.",
  "watchlist.removed": "Removed from watchlist.",
  "watchlist.errorPayloadIncomplete": "Movie payload is incomplete.",
  "watchlist.errorSupabase": "Supabase is not configured.",
  "watchlist.errorSignIn": "Sign in to use your watchlist.",
  "watchlist.errorPrepareMovie": "Could not prepare movie record.",
  "watchlist.errorRemove": "Could not remove this title from your watchlist.",
  "watchlist.errorUpdate": "Could not update your watchlist.",

  "movie.details": "Movie details",
  "movie.detailsUnavailable": "Movie details unavailable",
  "movie.tmdbMissing": "TMDB could not be reached or your API token is missing. Add TMDB_API_READ_ACCESS_TOKEN and refresh.",
  "movie.trailerUnavailable": "Trailer unavailable",
  "movie.whereToWatch": "Where to watch",
  "movie.subscription": "Subscription",
  "movie.rent": "Rent",
  "movie.buy": "Buy",
  "movie.noSubscriptionData": "No subscription data available.",
  "movie.noRentData": "No rental data available.",
  "movie.noBuyData": "No purchase data available.",
  "movie.openProviders": "Open full provider details",
  "movie.cast": "Cast",
  "movie.castUnknownCharacter": "Unknown character",
  "movie.similarTitles": "Similar titles"
};

const UK_MESSAGES: Record<string, string> = {
  "lang.label": "Мова",
  "lang.switch": "Змінити мову",
  "nav.home": "Головна",
  "nav.watchlist": "Список перегляду",
  "nav.search": "Пошук",
  "nav.signIn": "Увійти",
  "nav.signOut": "Вийти",
  "nav.profile": "Профіль",
  "nav.backHome": "На головну",
  "nav.analytics": "Аналітика",
  "nav.auditLogs": "Журнал аудиту",
  "theme.switchToLight": "Увімкнути світлу тему",
  "theme.switchToDark": "Увімкнути темну тему",
  "theme.lightMode": "Світла тема",
  "theme.darkMode": "Темна тема",
  "home.featuredTonight": "Головне сьогодні",
  "home.watchTrailer": "Дивитись трейлер",
  "home.addToWatchlist": "Додати в список",
  "home.browseGenres": "Жанри",
  "home.trendingNow": "У тренді",
  "home.continueWatching": "Продовжити перегляд",
  "home.topPicks": "Топ для вас",
  "home.searchLabel": "Пошук фільмів",
  "home.searchPlaceholder": "Пошук за назвою, актором або жанром",
  "home.details": "Деталі",
  "home.defaultGenre": "Кіно",
  "home.lastUpdated": "Оновлено: {time}",
  "auth.welcome": "Ласкаво просимо до KinoVibe",
  "auth.welcomeSubtitle": "Увійдіть, щоб синхронізувати список перегляду, прогрес та персональні рекомендації.",
  "auth.signingIn": "Входимо...",
  "auth.createAccount": "Створити акаунт",
  "auth.forgotPassword": "Забули пароль",
  "auth.sendResetLink": "Надіслати посилання",
  "profile.title": "Налаштування профілю",
  "profile.subtitle": "Керуйте даними акаунта та безпекою.",
  "profile.firstName": "Ім'я",
  "profile.lastName": "Прізвище",
  "profile.website": "Вебсайт",
  "profile.country": "Країна",
  "profile.save": "Зберегти профіль",
  "profile.passwordTitle": "Зміна пароля",
  "profile.newPassword": "Новий пароль",
  "profile.confirmPassword": "Підтвердіть пароль",
  "profile.updatePassword": "Оновити пароль",
  "profile.securityHint": "Використайте щонайменше 8 символів.",
  "analytics.title": "Аналітика відвідувачів",
  "analytics.subtitle": "Трафік, кліки та додавання фільмів на сайті.",
  "common.email": "Email",
  "common.password": "Пароль",
  "common.previous": "Назад",
  "common.next": "Далі",
  "common.page": "Сторінка",
  "common.of": "з",
  "common.sending": "Надсилаємо...",
  "common.updating": "Оновлення...",
  "common.saving": "Збереження...",
  "search.placeholder": "Пошук за назвою, актором або ключовим словом",
  "search.aria": "Пошук фільмів",
  "search.noMatches": "Нічого не знайдено",
  "watchlist.title": "Мій список перегляду",
  "watchlist.savedTitles": "збережених фільмів",
  "watchlist.emptyTitle": "Список порожній",
  "watchlist.emptyHint": "Відкрийте пошук або сторінку фільму і додайте перший тайтл.",
  "watchlist.findMovies": "Знайти фільми",
  "watchlist.status.toWatch": "Заплановано",
  "watchlist.status.watching": "Дивлюся",
  "watchlist.status.watched": "Переглянуто",
  "movie.details": "Деталі фільму",
  "movie.whereToWatch": "Де дивитися",
  "movie.subscription": "Підписка",
  "movie.rent": "Оренда",
  "movie.buy": "Купівля",
  "movie.cast": "Акторський склад",
  "movie.similarTitles": "Схожі фільми"
};

const TRANSLATIONS: Record<Locale, Record<string, string>> = {
  en: BASE_MESSAGES,
  uk: { ...BASE_MESSAGES, ...AUTO_TRANSLATIONS.uk, ...UK_MESSAGES },
  de: { ...BASE_MESSAGES, ...AUTO_TRANSLATIONS.de },
  fr: { ...BASE_MESSAGES, ...AUTO_TRANSLATIONS.fr },
  it: { ...BASE_MESSAGES, ...AUTO_TRANSLATIONS.it },
  es: { ...BASE_MESSAGES, ...AUTO_TRANSLATIONS.es },
  sv: { ...BASE_MESSAGES, ...AUTO_TRANSLATIONS.sv },
  fi: { ...BASE_MESSAGES, ...AUTO_TRANSLATIONS.fi },
  no: { ...BASE_MESSAGES, ...AUTO_TRANSLATIONS.no },
  da: { ...BASE_MESSAGES, ...AUTO_TRANSLATIONS.da },
  cs: { ...BASE_MESSAGES, ...AUTO_TRANSLATIONS.cs },
  pl: { ...BASE_MESSAGES, ...AUTO_TRANSLATIONS.pl },
  sk: { ...BASE_MESSAGES, ...AUTO_TRANSLATIONS.sk },
  hu: { ...BASE_MESSAGES, ...AUTO_TRANSLATIONS.hu },
  ro: { ...BASE_MESSAGES, ...AUTO_TRANSLATIONS.ro },
  el: { ...BASE_MESSAGES, ...AUTO_TRANSLATIONS.el },
  hr: { ...BASE_MESSAGES, ...AUTO_TRANSLATIONS.hr },
  me: { ...BASE_MESSAGES, ...AUTO_TRANSLATIONS.me }
};

const TMDB_LANGUAGE_BY_LOCALE: Record<Locale, string> = {
  en: "en-US",
  uk: "uk-UA",
  de: "de-DE",
  fr: "fr-FR",
  it: "it-IT",
  es: "es-ES",
  sv: "sv-SE",
  fi: "fi-FI",
  no: "no-NO",
  da: "da-DK",
  cs: "cs-CZ",
  pl: "pl-PL",
  sk: "sk-SK",
  hu: "hu-HU",
  ro: "ro-RO",
  el: "el-GR",
  hr: "hr-HR",
  me: "sr-RS"
};

function formatMessage(template: string, params?: TranslateParams): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    const value = params[key];
    if (value === undefined || value === null) {
      return match;
    }
    return String(value);
  });
}

export function getBaseMessages(): Record<string, string> {
  return { ...BASE_MESSAGES };
}

export function getLocaleCookieKey(): string {
  return COOKIE_LOCALE_KEY;
}

export function normalizeLocale(value: string | null | undefined): Locale {
  if (!value) {
    return DEFAULT_LOCALE;
  }
  const normalized = value.toLowerCase();
  const allowed = SUPPORTED_LOCALES.map((entry) => entry.value);
  return (allowed.includes(normalized as Locale) ? normalized : DEFAULT_LOCALE) as Locale;
}

export function translate(locale: Locale, key: string, params?: TranslateParams): string {
  const template =
    TRANSLATIONS[locale][key] ?? TRANSLATIONS[DEFAULT_LOCALE][key] ?? key;
  return formatMessage(template, params);
}

export function toTmdbLanguage(locale: Locale): string {
  return TMDB_LANGUAGE_BY_LOCALE[locale] ?? TMDB_LANGUAGE_BY_LOCALE[DEFAULT_LOCALE];
}

export function toIntlLocale(locale: Locale): string {
  return toTmdbLanguage(locale);
}
