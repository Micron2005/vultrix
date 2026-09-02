import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { Nav } from "@/components/nav";
import { DemoBanner } from "@/components/DemoBanner";
import { getCurrentUser, canManageUsers } from "@/lib/session";
import { canViewFinancials } from "@/lib/permissions";
import { isDemoOrg } from "@/lib/demo";
import { APP_NAME } from "@/lib/branding";
import { enabledFeatureSet } from "@/lib/features";
import { AssistantClient } from "@/app/assistant/AssistantClient";
import type { ThemeMode } from "@/components/ThemeToggle";
import { db } from "@/lib/db";
import {
  DEFAULT_APPEARANCE,
  appearanceCss,
  normalizeAppearance,
} from "@/lib/appearance";

export const metadata: Metadata = {
  title: APP_NAME,
  description: `Shop management powered by ${APP_NAME}`,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  const pathname = (await headers()).get("x-pathname") ?? "";

  // Logged-out visitors — and anyone viewing the public /home landing page,
  // even while signed in — get full-bleed pages with no app chrome. This covers
  // the marketing landing page (homepage + /home), /login, /signup, the legal
  // pages, and the public customer portals — each renders its own full-screen
  // layout, so no sidebar/max-width wrapper here.
  if (!user || pathname === "/home" || pathname === "/status") {
    return (
      <html lang="en" className="h-full">
        <body className="min-h-full bg-zinc-50 text-zinc-900 antialiased">
          {children}
        </body>
      </html>
    );
  }

  const themeCookie = (await cookies()).get("vx-theme")?.value;
  const theme: ThemeMode =
    themeCookie === "light" || themeCookie === "dark" ? themeCookie : "system";
  const orgLabel = user.orgName ?? APP_NAME;
  const enabledFeatures = Array.from(enabledFeatureSet(user));
  const isPersonal = user.accountType === "PERSONAL";
  const appearanceRecord = isPersonal
    ? await db.user.findUnique({
        where: { id: user.id },
        select: {
          uiPalette: true,
          uiAccent: true,
          uiScale: true,
          uiRadius: true,
          uiFont: true,
          navLayout: true,
        },
      })
    : null;
  const appearancePrefs = normalizeAppearance(
    appearanceRecord
      ? {
          palette: appearanceRecord.uiPalette,
          accent: appearanceRecord.uiAccent,
          scale: appearanceRecord.uiScale,
          radius: appearanceRecord.uiRadius,
          font: appearanceRecord.uiFont,
        }
      : DEFAULT_APPEARANCE,
  );
  const appearanceStyles = appearanceCss(appearancePrefs);

  return (
    <html
      lang="en"
      className={theme === "dark" ? "dark h-full" : "h-full"}
      data-vx-theme={isPersonal ? "custom" : undefined}
      suppressHydrationWarning={theme === "system"}
    >
      <head>
        {theme === "system" && (
          <script
            dangerouslySetInnerHTML={{
              __html:
                'if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) document.documentElement.classList.add("dark");',
            }}
          />
        )}
        {appearanceStyles && (
          <style
            id="vx-appearance"
            dangerouslySetInnerHTML={{ __html: appearanceStyles }}
          />
        )}
      </head>
      <body className="min-h-full bg-zinc-50 text-zinc-900 antialiased">
        <div className="flex min-h-screen">
          <Nav
            orgLabel={orgLabel}
            username={user.username}
            canViewFinancials={canViewFinancials(user.role)}
            canManageUsers={canManageUsers(user.role)}
            isSuperadmin={user.role === "SUPERADMIN"}
            enabledFeatures={enabledFeatures}
            accountType={user.accountType}
            aiAssistantEnabled={
              user.accountType === "PERSONAL" && user.aiAssistantEnabled
            }
            navLayout={isPersonal ? appearanceRecord?.navLayout : null}
          />
          <main className="flex-1 min-w-0 overflow-auto pt-14 lg:pt-0">
            {isDemoOrg(user.orgId) && <DemoBanner />}
            <div className="mx-auto max-w-6xl p-4 sm:p-6">{children}</div>
          </main>
          {user.accountType === "PERSONAL" && user.aiAssistantEnabled && (
            <AssistantClient
              floating
              assistantName={user.aiAssistantName}
              voiceIdentifier={user.aiAssistantVoice}
            />
          )}
        </div>
      </body>
    </html>
  );
}
