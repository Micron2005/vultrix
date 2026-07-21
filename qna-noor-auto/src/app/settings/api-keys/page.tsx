import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/session";
import { listApiKeys } from "@/lib/apiKeys";
import { ApiKeysManager, type ApiKeyListItem } from "./ApiKeysManager";

export const dynamic = "force-dynamic";

async function resolveOrigin(): Promise<string> {
  const hdrs = await headers();
  const forwardedHost = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const forwardedProto =
    hdrs.get("x-forwarded-proto") ??
    (forwardedHost.startsWith("localhost") ? "http" : "https");
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
}

export default async function ApiKeysPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (
    !me.orgId ||
    (me.role !== "OWNER" && me.role !== "ADMIN")
  ) {
    redirect("/settings");
  }

  const [keys, apiBaseUrl] = await Promise.all([
    listApiKeys(me.orgId),
    resolveOrigin(),
  ]);
  const apiKeys: ApiKeyListItem[] = keys.map((key) => ({
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    revokedAt: key.revokedAt?.toISOString() ?? null,
  }));

  return (
    <>
      <PageHeader
        title="API keys"
        description="Connect your own assistant to your organization through the Vultrix API."
      />
      <ApiKeysManager apiKeys={apiKeys} apiBaseUrl={apiBaseUrl} />
    </>
  );
}
