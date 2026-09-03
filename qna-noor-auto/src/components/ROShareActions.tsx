"use client";

import { ShareActions } from "./ShareActions";
import type { CustomerContactLists } from "@/lib/customerContacts";
import { formatMoney } from "@/lib/utils";

export function ROShareActions({
  token,
  contactLists,
  customerName,
  roNumber,
  shopName,
  docLabel,
  depositDue = 0,
  compact = false,
}: {
  token: string;
  contactLists: CustomerContactLists;
  customerName: string;
  roNumber: number;
  shopName: string;
  docLabel: "Estimate" | "Invoice";
  depositDue?: number;
  compact?: boolean;
}) {
  const firstName = customerName.split(" ")[0] || "there";
  const verb = docLabel === "Estimate" ? "estimate" : "invoice";

  return (
    <ShareActions
      token={token}
      contactLists={contactLists}
      customerName={customerName}
      compact={compact}
      emailSubject={`${shopName} — ${docLabel} #${roNumber}`}
      buildEmailBody={(shareUrl) =>
        `Hi ${firstName},\n\n` +
        `Here's your ${verb} for RO #${roNumber}:\n${shareUrl}\n\n` +
        (docLabel === "Estimate"
          ? `You can review the details, approve the estimate, and see your balance.\n\n`
          : `You can review the itemized charges, print a copy, or reply to this message with any questions.\n\n`) +
        (depositDue > 0
          ? `A deposit of ${formatMoney(depositDue)} is requested — you can pay it securely from the link above.\n\n`
          : "") +
        `Thanks,\n${shopName}`
      }
      buildSmsBody={(shareUrl) =>
        `${shopName} — ${verb} for RO #${roNumber}: ${shareUrl}` +
        (depositDue > 0 ? ` Deposit due: ${formatMoney(depositDue)}.` : "")
      }
    />
  );
}
