import Image from "next/image";
import { notFound } from "next/navigation";
import { verifyUnsubscribeToken } from "@/lib/announcements";
import { db } from "@/lib/db";
import { confirmAnnouncementUnsubscribe } from "./actions";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams?: Promise<{
    o?: string | string[];
    t?: string | string[];
    done?: string;
    error?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const orgId = Array.isArray(params.o) ? params.o[0] : params.o;
  const token = Array.isArray(params.t) ? params.t[0] : params.t;
  if (!orgId || !token || !verifyUnsubscribeToken(orgId, token)) notFound();
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true, announcementsOptOut: true },
  });
  if (!org) notFound();
  const complete = params.done === "1" || org.announcementsOptOut;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <section className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <Image
            src="/brand/vultrix-mark-email.png"
            alt="Vultrix"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <span className="text-lg font-semibold">Vultrix</span>
        </div>
        {complete ? (
          <>
            <h1 className="break-words text-xl font-semibold">
              Announcement emails are off for {org.name}.
            </h1>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Receipts, password resets, and other account emails are unaffected.
              You can turn announcement emails back on in Settings.
            </p>
          </>
        ) : (
          <>
            <h1 className="break-words text-xl font-semibold">
              Stop Vultrix announcement emails for {org.name}?
            </h1>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Receipts, password resets, and other account emails are unaffected.
            </p>
            {params.error === "invalid" && (
              <p className="mt-3 text-sm text-red-700">
                This unsubscribe link is invalid or has expired.
              </p>
            )}
            <form action={confirmAnnouncementUnsubscribe} className="mt-6">
              <input type="hidden" name="o" value={orgId} />
              <input type="hidden" name="t" value={token} />
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Stop announcement emails
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
