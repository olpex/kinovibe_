export type Locale = "en" | "uk";

export const DEFAULT_LOCALE: Locale = "en";
const COOKIE_LOCALE_KEY = "kv_lang";

const MESSAGES: Record<Locale, Record<string, string>> = {
  en: {
    "lang.label": "Language",
    "lang.en": "English",
    "lang.uk": "Ukrainian",
    "nav.home": "Home",
    "nav.watchlist": "Watchlist",
    "nav.search": "Search",
    "nav.signIn": "Sign in",
    "nav.signOut": "Sign out",
    "nav.profile": "Profile",
    "nav.backHome": "Back home",
    "home.featuredTonight": "Featured tonight",
    "home.watchTrailer": "Watch trailer",
    "home.addToWatchlist": "Add to watchlist",
    "home.browseGenres": "Browse genres",
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
    "analytics.title": "Visitor analytics",
    "analytics.subtitle": "Traffic, clicks, and movie-add events from site activity.",
    "analytics.countries": "Countries",
    "analytics.ips": "IP addresses",
    "analytics.pages": "Top pages",
    "analytics.clicks": "Top clicks",
    "analytics.movies": "Movies added",
    "analytics.visits": "Visits",
    "analytics.events": "Events"
  },
  uk: {
    "lang.label": "Мова",
    "lang.en": "Англійська",
    "lang.uk": "Українська",
    "nav.home": "Головна",
    "nav.watchlist": "Список перегляду",
    "nav.search": "Пошук",
    "nav.signIn": "Увійти",
    "nav.signOut": "Вийти",
    "nav.profile": "Профіль",
    "nav.backHome": "На головну",
    "home.featuredTonight": "Головне сьогодні",
    "home.watchTrailer": "Дивитись трейлер",
    "home.addToWatchlist": "Додати в список",
    "home.browseGenres": "Жанри",
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
    "analytics.countries": "Країни",
    "analytics.ips": "IP-адреси",
    "analytics.pages": "Популярні сторінки",
    "analytics.clicks": "Популярні кліки",
    "analytics.movies": "Додані фільми",
    "analytics.visits": "Відвідування",
    "analytics.events": "Події"
  }
};

export function getLocaleCookieKey(): string {
  return COOKIE_LOCALE_KEY;
}

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === "uk" ? "uk" : DEFAULT_LOCALE;
}

export function translate(locale: Locale, key: string): string {
  return MESSAGES[locale][key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
}
