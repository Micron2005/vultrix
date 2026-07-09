"use client";

import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { CustomerPicker, type PickerCustomer } from "@/components/CustomerPicker";

type Props = {
  action: (fd: FormData) => void | Promise<void>;
  customers: PickerCustomer[];
};

/**
 * Step 1 of the New Repair Order flow. Lets the user either pick an existing
 * customer (search box) OR create a brand-new one inline — so a walk-in can be
 * added without leaving the ticket-writing flow. On submit the server action
 * creates the customer (when in "new" mode) and redirects back into the flow,
 * which advances straight to the "add vehicle" step and then the RO.
 */
export function CustomerPickerOrCreate({ action, customers }: Props) {
  const [mode, setMode] = useState<"existing" | "new">(
    customers.length > 0 ? "existing" : "new",
  );
  const [type, setType] = useState<"INDIVIDUAL" | "BUSINESS">("INDIVIDUAL");

  return (
    <form action={action} className="space-y-4" data-testid="customer-step-form">
      <input type="hidden" name="mode" value={mode} />

      {customers.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            data-testid="mode-existing-customer"
            className={`rounded px-3 py-1 border ${
              mode === "existing"
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-700 border-zinc-300 hover:border-zinc-400"
            }`}
            onClick={() => setMode("existing")}
          >
            Existing customer
          </button>
          <button
            type="button"
            data-testid="mode-new-customer"
            className={`rounded px-3 py-1 border ${
              mode === "new"
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-700 border-zinc-300 hover:border-zinc-400"
            }`}
            onClick={() => setMode("new")}
          >
            + Add new customer
          </button>
        </div>
      )}

      {mode === "existing" ? (
        <Field label="Customer">
          <CustomerPicker customers={customers} />
        </Field>
      ) : (
        <div className="space-y-4" data-testid="new-customer-fields">
          <Field label="Customer type">
            <div className="flex gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="type"
                  value="INDIVIDUAL"
                  checked={type === "INDIVIDUAL"}
                  onChange={() => setType("INDIVIDUAL")}
                  data-testid="new-customer-type-individual"
                />
                Individual
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="type"
                  value="BUSINESS"
                  checked={type === "BUSINESS"}
                  onChange={() => setType("BUSINESS")}
                  data-testid="new-customer-type-business"
                />
                Business
              </label>
            </div>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="First name *">
              <Input
                name="firstName"
                required={mode === "new"}
                autoComplete="off"
                data-testid="new-customer-first-name"
              />
            </Field>
            <Field label="Last name *">
              <Input
                name="lastName"
                required={mode === "new"}
                autoComplete="off"
                data-testid="new-customer-last-name"
              />
            </Field>
          </div>

          {type === "BUSINESS" && (
            <Field label="Company name">
              <Input
                name="companyName"
                autoComplete="off"
                data-testid="new-customer-company-name"
              />
            </Field>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Phone">
              <Input
                name="phone"
                type="tel"
                autoComplete="off"
                data-testid="new-customer-phone"
              />
            </Field>
            <Field label="Alt phone">
              <Input
                name="altPhone"
                type="tel"
                autoComplete="off"
                data-testid="new-customer-alt-phone"
              />
            </Field>
          </div>

          <Field label="Email">
            <Input
              name="email"
              type="email"
              autoComplete="off"
              data-testid="new-customer-email"
            />
          </Field>

          <p className="text-xs text-zinc-500">
            You can add more customer details later from the Customers page.
            Next you&apos;ll add the vehicle and continue into the repair order.
          </p>
        </div>
      )}

      <Button type="submit" data-testid="customer-continue-button">
        Continue
      </Button>
    </form>
  );
}
