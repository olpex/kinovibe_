import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Space_Grotesk } from "next/font/google";
import { SiteActivityTracker } from "@/components/analytics/site-activity-tracker";
import { SiteFooter } from "@/components/navigation/site-footer";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import { resolveMetadataBase, resolveSiteUrl } from "@/lib/seo/site";
import "./globals.css";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap"
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap"
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const siteTitle = translate(locale, "meta.siteTitle");
  const siteDescription = translate(locale, "meta.siteDescription");
  const siteUrl = resolveSiteUrl();
  const ogLocale = toIntlLocale(locale).replace("-", "_");

  return {
    metadataBase: resolveMetadataBase(),
    title: siteTitle,
    description: siteDescription,
    verification: {
      google: "hfkzuAhdV6jsStuxMJ_xNeOYHidl19gY-qvqk8LEJFA"
    },
    applicationName: siteTitle,
    referrer: "origin-when-cross-origin",
    keywords: [
      "movies",
      "tv shows",
      "cinema",
      "movie discovery",
      "watchlist",
      "kino",
      "kinovibe"
    ],
    openGraph: {
      type: "website",
      locale: ogLocale,
      url: siteUrl,
      siteName: siteTitle,
      title: siteTitle,
      description: siteDescription,
      images: [
        {
          url: `${siteUrl}/icon.svg`,
          alt: `${siteTitle} logo`
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: siteTitle,
      description: siteDescription,
      images: [`${siteUrl}/icon.svg`]
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1
      }
    }
  };
}

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default async function RootLayout({ children }: RootLayoutProps) {
  const locale = await getRequestLocale();
  const siteTitle = translate(locale, "meta.siteTitle");
  const siteDescription = translate(locale, "meta.siteDescription");
  const siteUrl = resolveSiteUrl();
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteTitle,
    url: siteUrl,
    logo: `${siteUrl}/icon.svg`
  };
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteTitle,
    url: siteUrl,
    description: siteDescription,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <html lang={locale}>
      <body
        data-theme="dark"
        className={`${headingFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <SiteActivityTracker />
        {children}
        <SiteFooter locale={locale} />
      </body>
    </html>
  );
}
