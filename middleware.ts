import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const MAINTENANCE_COOKIE = "__kinovibe_maintenance_access";
const MAINTENANCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const PROTECTED_PATHS = ["/watchlist", "/profile", "/auth/reset", "/admin"];

function buildSafeNextParam(request: NextRequest): string {
  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;
  return `${pathname}${search}`;
}

function isMaintenanceModeEnabled(): boolean {
  return (process.env.MAINTENANCE_MODE ?? "").trim().toLowerCase() === "true";
}

function getMaintenanceBypassKey(): string {
  return (process.env.MAINTENANCE_BYPASS_KEY ?? "").trim();
}

function getSubmittedMaintenanceKey(request: NextRequest): string {
  return (
    request.nextUrl.searchParams.get("key") ??
    request.nextUrl.searchParams.get("maintenance_key") ??
    ""
  ).trim();
}

function clearBypassKeyFromUrl(request: NextRequest): URL {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.searchParams.delete("key");
  redirectUrl.searchParams.delete("maintenance_key");
  return redirectUrl;
}

function createMaintenanceResponse(): NextResponse {
  return new NextResponse(
    `<!doctype html>
<html lang="uk">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Технічні роботи</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Arial, Helvetica, sans-serif;
        background: #101418;
        color: #f4f7fb;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
      }

      main {
        max-width: 760px;
      }

      h1 {
        margin: 0 0 12px;
        font-size: clamp(32px, 7vw, 56px);
        line-height: 1;
      }

      p {
        margin: 0;
        color: #c8d1dc;
        font-size: 18px;
        line-height: 1.55;
      }

      ul {
        margin: 24px 0 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 12px;
      }

      li {
        color: #dce4ee;
        font-size: 15px;
        line-height: 1.45;
      }

      strong {
        color: #ffffff;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>KinoVibe</h1>
      <p>Сайт тимчасово закритий до моменту оплати проєкту за PRO-планом за допомогою небайдужих відвідувачів.</p>
      <ul aria-label="Maintenance notice translations">
        <li><strong>English:</strong> The site is temporarily closed until the project is paid for under the PRO plan with the help of caring visitors.</li>
        <li><strong>Français:</strong> Le site est temporairement fermé jusqu'au paiement du projet dans le cadre du plan PRO avec l'aide de visiteurs bienveillants.</li>
        <li><strong>Italiano:</strong> Il sito è temporaneamente chiuso fino al pagamento del progetto con il piano PRO grazie all'aiuto dei visitatori interessati.</li>
        <li><strong>Deutsch:</strong> Die Website ist vorübergehend geschlossen, bis das Projekt mit dem PRO-Plan mithilfe engagierter Besucher bezahlt wird.</li>
        <li><strong>Polski:</strong> Strona jest tymczasowo zamknięta do czasu opłacenia projektu w planie PRO dzięki pomocy zaangażowanych odwiedzających.</li>
        <li><strong>Română:</strong> Site-ul este închis temporar până la achitarea proiectului prin planul PRO, cu ajutorul vizitatorilor cărora le pasă.</li>
        <li><strong>Български:</strong> Сайтът е временно затворен до заплащането на проекта по PRO плана с помощта на загрижени посетители.</li>
        <li><strong>Svenska:</strong> Webbplatsen är tillfälligt stängd tills projektet har betalats via PRO-planen med hjälp av omtänksamma besökare.</li>
        <li><strong>Suomi:</strong> Sivusto on väliaikaisesti suljettu, kunnes projekti on maksettu PRO-paketilla välittävien kävijöiden avulla.</li>
        <li><strong>Magyar:</strong> Az oldal ideiglenesen zárva van, amíg a projekt a PRO csomag keretében, segítőkész látogatók támogatásával ki nem lesz fizetve.</li>
        <li><strong>Čeština:</strong> Web je dočasně uzavřen, dokud nebude projekt uhrazen v rámci plánu PRO s pomocí návštěvníků, kterým na něm záleží.</li>
        <li><strong>Slovenčina:</strong> Stránka je dočasne zatvorená, kým nebude projekt uhradený v rámci plánu PRO s pomocou návštevníkov, ktorým na ňom záleží.</li>
        <li><strong>Dansk:</strong> Webstedet er midlertidigt lukket, indtil projektet er betalt via PRO-planen med hjælp fra engagerede besøgende.</li>
      </ul>
    </main>
  </body>
</html>`,
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
        "Retry-After": "3600",
        "X-Robots-Tag": "noindex, nofollow"
      }
    }
  );
}

function handleMaintenanceMode(request: NextRequest): NextResponse | null {
  if (!isMaintenanceModeEnabled()) {
    return null;
  }

  const bypassKey = getMaintenanceBypassKey();
  const submittedKey = getSubmittedMaintenanceKey(request);
  const hasSubmittedValidKey = Boolean(bypassKey && submittedKey === bypassKey);

  if (hasSubmittedValidKey) {
    const response = NextResponse.redirect(clearBypassKeyFromUrl(request));
    response.cookies.set(MAINTENANCE_COOKIE, bypassKey, {
      httpOnly: true,
      maxAge: MAINTENANCE_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });
    return response;
  }

  const hasStoredValidKey =
    Boolean(bypassKey) && request.cookies.get(MAINTENANCE_COOKIE)?.value === bypassKey;

  if (hasStoredValidKey) {
    return null;
  }

  return createMaintenanceResponse();
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(request: NextRequest) {
  const maintenanceResponse = handleMaintenanceMode(request);

  if (maintenanceResponse) {
    return maintenanceResponse;
  }

  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    redirectUrl.searchParams.set("next", buildSafeNextParam(request));
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image).*)"
  ]
};
