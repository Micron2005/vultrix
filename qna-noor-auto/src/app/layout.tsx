import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { getCurrentUser, canManageUsers } from "@/lib/session";
import { APP_NAME } from "@/lib/branding";

export const metadata: Metadata = {
  title: APP_NAME,
  description: `Shop management powered by ${APP_NAME}`,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  const orgLabel = user?.orgName ?? APP_NAME;

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-zinc-50 text-zinc-900 antialiased">
        <div className="flex min-h-screen">
          <Nav
            orgLabel={orgLabel}
            username={user?.username ?? null}
            canManageUsers={user ? canManageUsers(user.role) : false}
            isSuperadmin={user?.role === "SUPERADMIN"}
          />
          <main className="flex-1 overflow-auto">
            <div className="mx-auto max-w-6xl p-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
