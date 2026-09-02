import { db } from "@/lib/db";
import { DEFAULT_MAIL_FROM } from "@/lib/branding";
import { billingConfigured, getStripe } from "@/lib/stripe";

export type StatusState =
  | "operational"
  | "degraded"
  | "down"
  | "not_configured";

export type StatusCheck = {
  key: string;
  label: string;
  state: StatusState;
  detail: string;
  latencyMs?: number;
};

type CacheEntry = {
  value: StatusCheck;
  expiresAt: number;
};

const CHECK_TIMEOUT_MS = 3000;
const PROVIDER_CACHE_TTL_MS = 60_000;

let emailCache: CacheEntry | null = null;
let paymentsCache: CacheEntry | null = null;

function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function checkDatabase(): Promise<StatusCheck> {
  const started = Date.now();
  try {
    await withTimeout(db.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS);
    const latencyMs = Date.now() - started;
    return {
      key: "database",
      label: "Database",
      state: latencyMs > 1000 ? "degraded" : "operational",
      detail: latencyMs > 1000 ? "Responding slowly" : "Responding",
      latencyMs,
    };
  } catch {
    return {
      key: "database",
      label: "Database",
      state: "down",
      detail: "Unable to connect",
    };
  }
}

function senderDomain(): string {
  const sender =
    process.env.MAIL_FROM ||
    process.env.LEADS_FROM_EMAIL ||
    DEFAULT_MAIL_FROM;
  const match = sender.match(/@([^>\s]+)/);
  return match?.[1]?.toLowerCase() ?? "";
}

async function checkEmailUncached(): Promise<StatusCheck> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      key: "email",
      label: "Email",
      state: "not_configured",
      detail: "Not configured",
    };
  }

  const controller = new AbortController();
  try {
    const response = await withTimeout(
      fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      }),
      CHECK_TIMEOUT_MS,
    );
    if (!response.ok) {
      return {
        key: "email",
        label: "Email",
        state: "down",
        detail: "Provider unavailable",
      };
    }

    const payload: unknown = await response.json();
    const domains =
      payload &&
      typeof payload === "object" &&
      "data" in payload &&
      Array.isArray(payload.data)
        ? payload.data
        : [];
    const configuredDomain = senderDomain();
    const matchingDomain = domains.find(
      (domain): domain is { name?: unknown; status?: unknown } =>
        Boolean(domain) &&
        typeof domain === "object" &&
        (!configuredDomain ||
          ("name" in domain &&
            typeof domain.name === "string" &&
            domain.name.toLowerCase() === configuredDomain)),
    );
    const verified =
      matchingDomain &&
      "status" in matchingDomain &&
      matchingDomain.status === "verified";

    return {
      key: "email",
      label: "Email",
      state: verified ? "operational" : "degraded",
      detail: verified ? "Send domain verified" : "Send domain needs attention",
    };
  } catch {
    return {
      key: "email",
      label: "Email",
      state: "down",
      detail: "Provider unavailable",
    };
  } finally {
    controller.abort();
  }
}

async function checkEmail(): Promise<StatusCheck> {
  if (emailCache && emailCache.expiresAt > Date.now()) return emailCache.value;
  const value = await checkEmailUncached();
  emailCache = {
    value,
    expiresAt: Date.now() + PROVIDER_CACHE_TTL_MS,
  };
  return value;
}

async function checkPaymentsUncached(): Promise<StatusCheck> {
  if (!billingConfigured()) {
    return {
      key: "payments",
      label: "Payments",
      state: "not_configured",
      detail: "Not configured",
    };
  }

  try {
    await withTimeout(getStripe().prices.list({ limit: 1 }), CHECK_TIMEOUT_MS);
    return {
      key: "payments",
      label: "Payments",
      state: "operational",
      detail: "Responding",
    };
  } catch {
    return {
      key: "payments",
      label: "Payments",
      state: "down",
      detail: "Provider unavailable",
    };
  }
}

async function checkPayments(): Promise<StatusCheck> {
  if (paymentsCache && paymentsCache.expiresAt > Date.now()) {
    return paymentsCache.value;
  }
  const value = await checkPaymentsUncached();
  paymentsCache = {
    value,
    expiresAt: Date.now() + PROVIDER_CACHE_TTL_MS,
  };
  return value;
}

export async function getStatusChecks(): Promise<StatusCheck[]> {
  const [database, email, payments] = await Promise.all([
    checkDatabase(),
    checkEmail(),
    checkPayments(),
  ]);
  return [
    {
      key: "app",
      label: "App",
      state: "operational",
      detail: "Responding",
    },
    database,
    email,
    payments,
  ];
}
