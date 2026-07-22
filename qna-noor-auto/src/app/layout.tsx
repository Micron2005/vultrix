import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Nav } from "@/components/nav";
import { DemoBanner } from "@/components/DemoBanner";
import { getCurrentUser, canManageUsers } from "@/lib/session";
import { isDemoOrg } from "@/lib/demo";
import { APP_NAME } from "@/lib/branding";
import { enabledFeatureSet } from "@/lib/features";

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
  if (!user || pathname === "/home") {
    return (
      <html lang="en" className="h-full">
        <body className="min-h-full bg-zinc-50 text-zinc-900 antialiased">
          {children}
        </body>
      </html>
    );
  }

  const orgLabel = user.orgName ?? APP_NAME;
  const enabledFeatures = Array.from(enabledFeatureSet(user));

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-zinc-50 text-zinc-900 antialiased">
        <div className="flex min-h-screen">
          <Nav
            orgLabel={orgLabel}
            username={user.username}
            canManageUsers={canManageUsers(user.role)}
            isSuperadmin={user.role === "SUPERADMIN"}
            enabledFeatures={enabledFeatures}
            accountType={user.accountType}
            aiAssistantEnabled={
              user.accountType === "PERSONAL" && user.aiAssistantEnabled
            }
          />
          <main className="flex-1 min-w-0 overflow-auto pt-14 lg:pt-0">
            {isDemoOrg(user.orgId) && <DemoBanner />}
            <div className="mx-auto max-w-6xl p-4 sm:p-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
