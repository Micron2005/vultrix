"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  highlight,
  sublines,
  customers,
}: {
  label: string;
  value: string;
  highlight: boolean;
  sublines?: string[];
  customers: OwedCustomer[];
}) {
  const [expanded, setExpanded] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canExpand = customers.length > 0;

  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setExpanded(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

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
      highlight={highlight}
      sublines={sublines}
    />
  );

  return (
    <div ref={wrapperRef} className="relative">
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
        <div className="absolute right-0 top-full z-50 mt-2 max-h-64 min-w-[20rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-amber-200 bg-white shadow-lg">
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
