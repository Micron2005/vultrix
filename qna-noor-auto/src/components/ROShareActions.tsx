"use client";

import { ShareActions } from "./ShareActions";

export function ROShareActions({
  token,
  customerEmail,
  customerPhone,
  customerName,
  roNumber,
  shopName,
  docLabel,
  compact = false,
}: {
  token: string;
  customerEmail: string | null | undefined;
  customerPhone: string | null | undefined;
  customerName: string;
  roNumber: number;
  shopName: string;
  docLabel: "Estimate" | "Invoice";
  compact?: boolean;
}) {
  const firstName = customerName.split(" ")[0] || "there";
  const verb = docLabel === "Estimate" ? "estimate" : "invoice";

  return (
    <ShareActions
      token={token}
      customerEmail={customerEmail}
      customerPhone={customerPhone}
      customerName={customerName}
      compact={compact}
      emailSubject={`${shopName} — ${docLabel} #${roNumber}`}
      buildEmailBody={(shareUrl) =>
        `Hi ${firstName},\n\n` +
        `Here's your ${verb} for RO #${roNumber}:\n${shareUrl}\n\n` +
        (docLabel === "Estimate"
          ? `You can review the details, approve the estimate, and see your balance.\n\n`
          : `You can review the itemized charges, print a copy, or reply to this message with any questions.\n\n`) +
        `Thanks,\n${shopName}`
      }
      buildSmsBody={(shareUrl) =>
        `${shopName} — ${verb} for RO #${roNumber}: ${shareUrl}`
      }
    />
  );
}
