import QRCode from "qrcode";
import Image from "next/image";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
} from "@/components/ui";
import { cookies } from "next/headers";
import { totpUri } from "@/lib/adminAuth";
import { verifySignedValue } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/session";
import {
  clearBackupCodes,
  confirmTotpEnrollment,
  regenerateBackupCodes,
  resetAuthenticator,
  startTotpEnrollment,
} from "./actions";

export const dynamic = "force-dynamic";

const PENDING_COOKIE = "admin_totp_pending";
const BACKUP_CODES_COOKIE = "admin_backup_codes_once";

function readBackupCodes(value: string | undefined): string[] {
  const signed = verifySignedValue(value);
  if (!signed) return [];
  try {
    const parsed: unknown = JSON.parse(signed);
    return Array.isArray(parsed) && parsed.every((code) => typeof code === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}

export default async function AdminSecurityPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const user = await requireSuperadmin({ allowUnenrolled: true });
  const sp = (await searchParams) ?? {};
  const store = await cookies();
  const pendingSecret = verifySignedValue(store.get(PENDING_COOKIE)?.value);
  const backupCodes = readBackupCodes(store.get(BACKUP_CODES_COOKIE)?.value);

  return (
    <div>
      <PageHeader
        title="Admin security"
        description="Protect the Vultrix platform admin account with an authenticator app."
      />

      {sp.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {sp.error === "reset-code"
            ? "Enter a valid current authenticator code to reset the authenticator."
            : "That code didn't match. Type the 6 digits your authenticator app is showing right now for \"Vultrix admin\" — the code changes every 30 seconds. If you scanned an older QR code, press \"Start over with a new QR code\" below, delete the old Vultrix admin entry in your app and scan again."}
        </div>
      )}

      {backupCodes.length > 0 && (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <CardHeader title="Save your backup codes" />
          <div className="space-y-3 p-4">
            <p className="text-sm text-amber-900">
              Each code works once if you lose access to your authenticator.
              Store these somewhere safe. They will not be shown again.
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-md bg-white p-3 font-mono text-sm text-zinc-900 sm:grid-cols-4">
              {backupCodes.map((code) => (
                <span key={code}>{code}</span>
              ))}
            </div>
            <form action={clearBackupCodes}>
              <Button type="submit" variant="secondary">
                I&apos;ve saved these
              </Button>
            </form>
          </div>
        </Card>
      )}

      {!user.totpEnrolled ? (
        <Card>
          <CardHeader title="Set up authenticator" />
          <div className="space-y-4 p-4">
            <p className="text-sm text-zinc-600">
              Admin sign-in requires an authenticator app (Google Authenticator,
              Microsoft Authenticator, 1Password or Authy — free on your phone).
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-600">
              <li>Open the app on your phone and choose Add / + / Scan a QR code.</li>
              <li>Point the camera at the code below (or type the setup key by hand).</li>
              <li>
                The app now shows a 6-digit number for &quot;Vultrix admin&quot; that
                changes every 30 seconds. You don&apos;t pick this number — type
                the one currently showing into the box and press Turn on.
              </li>
            </ol>
            {!pendingSecret ? (
              <form action={startTotpEnrollment}>
                <Button type="submit">Generate QR code</Button>
              </form>
            ) : (
              <EnrollmentForm secret={pendingSecret} username={user.username} />
            )}
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Authenticator: on" />
          <div className="space-y-5 p-4">
            <p className="text-sm text-zinc-600">
              Your authenticator is required for every platform admin sign-in.
            </p>
            <div className="space-y-2">
              <div className="text-sm font-medium text-zinc-800">
                Backup codes remaining: {user.totpEnrolled ? await backupCount(user.id) : 0}
              </div>
              <form action={regenerateBackupCodes}>
                <Button type="submit" variant="secondary">
                  Regenerate backup codes
                </Button>
              </form>
            </div>
            <div className="border-t border-zinc-200 pt-4">
              <form action={resetAuthenticator} className="max-w-sm space-y-3">
                <Field label="Current authenticator code">
                  <Input
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                </Field>
                <Button type="submit" variant="danger">
                  Reset authenticator
                </Button>
              </form>
            </div>
          </div>
        </Card>
      )}

      <p className="mt-6 text-xs text-zinc-500">
        Locked out? Run{" "}
        <code>npm run admin:reset-2fa -- &lt;username&gt;</code> against the
        production database.
      </p>
    </div>
  );
}

async function backupCount(userId: string): Promise<number> {
  const record = await db.user.findUnique({
    where: { id: userId },
    select: { totpBackupCodes: true },
  });
  return record?.totpBackupCodes.length ?? 0;
}

async function EnrollmentForm({
  secret,
  username,
}: {
  secret: string;
  username: string;
}) {
  const uri = totpUri(username, secret);
  const qr = await QRCode.toDataURL(uri);
  return (
    <div className="space-y-4">
      <Image
        src={qr}
        alt="Authenticator setup QR code"
        width={192}
        height={192}
        unoptimized
        className="h-48 w-48"
      />
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Setup key
        </div>
        <code className="mt-1 block break-all rounded bg-zinc-100 p-2 text-sm text-zinc-900">
          {secret}
        </code>
      </div>
      <form action={confirmTotpEnrollment} className="max-w-sm space-y-3">
        <Field label="Authenticator code">
          <Input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code from the app"
            required
            pattern="[0-9]{6}"
          />
        </Field>
        <Button type="submit">Turn on</Button>
      </form>
      <form action={startTotpEnrollment}>
        <Button type="submit" variant="secondary">
          Start over with a new QR code
        </Button>
      </form>
    </div>
  );
}
