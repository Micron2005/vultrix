"use client";

import Link from "next/link";
import { useState } from "react";
import { StatCard } from "./StatCard";

type OwedCustomer = {
  id: string;
  name: string;
  amount: string;
  invoiceCount: number;
};

export function MoneyOwedCard({
  label,
  value,
  sublines,
  customers,
}: {
  label: string;
  value: string;
  sublines?: string[];
  customers: OwedCustomer[];
}) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = customers.length > 0;

  const card = (
    <StatCard
      label={
        <span className="flex items-center justify-between gap-2">
          <span>{label}</span>
          {canExpand && (
            <span
              aria-hidden="true"
              className={`text-base transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              ▾
            </span>
          )}
        </span>
      }
      value={value}
      highlight
      sublines={sublines}
    />
  );

  return (
    <div>
      {canExpand ? (
        <button
          type="button"
          className="block w-full cursor-pointer text-left"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} money owed details`}
        >
          {card}
        </button>
      ) : (
        card
      )}
      {expanded && (
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-amber-200 bg-white shadow-sm">
          {customers.map((customer) => (
            <Link
              key={customer.id}
              href={`/customers/${customer.id}`}
              className="flex items-center justify-between gap-4 border-b border-zinc-100 px-4 py-2.5 text-sm last:border-b-0 hover:bg-amber-50"
            >
              <span className="min-w-0 text-zinc-900">
                <span className="block truncate">{customer.name}</span>
                {customer.invoiceCount > 1 && (
                  <span className="block text-xs text-zinc-500">
                    {customer.invoiceCount} invoices
                  </span>
                )}
              </span>
              <span className="shrink-0 font-medium text-amber-900">
                {customer.amount}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
