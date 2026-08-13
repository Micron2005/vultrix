"use client";

import { useState } from "react";
import { Field, Input, Textarea } from "@/components/ui";
import { SaveButton } from "@/components/SaveButton";
import type { Customer, CustomerContact } from "@prisma/client";

type ContactRow = {
  key: string;
  value: string;
  label: string;
  isPrimary: boolean;
};

type CustomerWithContacts = Partial<Customer> & {
  contacts?: Pick<CustomerContact, "kind" | "value" | "label" | "isPrimary">[];
};

function initialRows(
  customer: CustomerWithContacts | undefined,
  kind: "EMAIL" | "PHONE",
): ContactRow[] {
  const contacts =
    customer?.contacts
      ?.filter((contact) => contact.kind === kind)
      .map((contact, index) => ({
        key: `${kind}-${index}`,
        value: contact.value,
        label: contact.label ?? "",
        isPrimary: contact.isPrimary,
      })) ?? [];
  if (contacts.length > 0) return contacts;

  const legacy =
    kind === "EMAIL" ? customer?.email : [customer?.phone, customer?.altPhone];
  return (Array.isArray(legacy) ? legacy : [legacy])
    .filter((value): value is string => Boolean(value))
    .map((value, index) => ({
      key: `${kind}-legacy-${index}`,
      value,
      label: "",
      isPrimary: index === 0,
    }));
}

export function CustomerForm({
  action,
  customer,
  submitLabel = "Save",
  defaultType,
}: {
  action: (fd: FormData) => void | Promise<void>;
  customer?: CustomerWithContacts;
  submitLabel?: string;
  defaultType?: "INDIVIDUAL" | "BUSINESS";
}) {
  const type = customer?.type ?? defaultType ?? "INDIVIDUAL";
  const [emails, setEmails] = useState(() => initialRows(customer, "EMAIL"));
  const [phones, setPhones] = useState(() => initialRows(customer, "PHONE"));

  function addRow(kind: "EMAIL" | "PHONE") {
    const setter = kind === "EMAIL" ? setEmails : setPhones;
    setter((rows) => [
      ...rows,
      {
        key: `${kind}-${Date.now()}-${rows.length}`,
        value: "",
        label: "",
        isPrimary: rows.length === 0,
      },
    ]);
  }

  function removeRow(kind: "EMAIL" | "PHONE", key: string) {
    const setter = kind === "EMAIL" ? setEmails : setPhones;
    setter((rows) => {
      const remaining = rows.filter((row) => row.key !== key);
      if (remaining.length > 0 && !remaining.some((row) => row.isPrimary)) {
        return remaining.map((row, index) => ({
          ...row,
          isPrimary: index === 0,
        }));
      }
      return remaining;
    });
  }

  function updateRow(
    kind: "EMAIL" | "PHONE",
    key: string,
    field: "value" | "label",
    value: string,
  ) {
    const setter = kind === "EMAIL" ? setEmails : setPhones;
    setter((rows) =>
      rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  }

  function setPrimary(kind: "EMAIL" | "PHONE", key: string) {
    const setter = kind === "EMAIL" ? setEmails : setPhones;
    setter((rows) =>
      rows.map((row) => ({ ...row, isPrimary: row.key === key })),
    );
  }

  return (
    <form action={action} className="space-y-6">
      <Field label="Customer type *">
        <div className="flex gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="type"
              value="INDIVIDUAL"
              defaultChecked={type === "INDIVIDUAL"}
            />
            Individual
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="type"
              value="BUSINESS"
              defaultChecked={type === "BUSINESS"}
            />
            Business
          </label>
        </div>
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="First name *">
          <Input name="firstName" required defaultValue={customer?.firstName ?? ""} />
        </Field>
        <Field label="Last name *">
          <Input name="lastName" required defaultValue={customer?.lastName ?? ""} />
        </Field>
        <Field label="Company name" className="md:col-span-2">
          <Input name="companyName" defaultValue={customer?.companyName ?? ""} />
        </Field>
        <ContactList
          kind="PHONE"
          rows={phones}
          onAdd={() => addRow("PHONE")}
          onRemove={(key) => removeRow("PHONE", key)}
          onUpdate={(key, field, value) => updateRow("PHONE", key, field, value)}
          onPrimary={(key) => setPrimary("PHONE", key)}
        />
        <ContactList
          kind="EMAIL"
          rows={emails}
          onAdd={() => addRow("EMAIL")}
          onRemove={(key) => removeRow("EMAIL", key)}
          onUpdate={(key, field, value) => updateRow("EMAIL", key, field, value)}
          onPrimary={(key) => setPrimary("EMAIL", key)}
        />
        <Field label="Street" className="md:col-span-2">
          <Input name="street" defaultValue={customer?.street ?? ""} />
        </Field>
        <Field label="City">
          <Input name="city" defaultValue={customer?.city ?? ""} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="State">
            <Input name="state" defaultValue={customer?.state ?? ""} />
          </Field>
          <Field label="ZIP">
            <Input name="zip" defaultValue={customer?.zip ?? ""} />
          </Field>
        </div>
        <Field label="Notes" className="md:col-span-2">
          <Textarea name="notes" rows={3} defaultValue={customer?.notes ?? ""} />
        </Field>
      </div>
      <div className="flex gap-2">
        <SaveButton>{submitLabel}</SaveButton>
      </div>
    </form>
  );
}

function ContactList({
  kind,
  rows,
  onAdd,
  onRemove,
  onUpdate,
  onPrimary,
}: {
  kind: "EMAIL" | "PHONE";
  rows: ContactRow[];
  onAdd: () => void;
  onRemove: (key: string) => void;
  onUpdate: (key: string, field: "value" | "label", value: string) => void;
  onPrimary: (key: string) => void;
}) {
  const isEmail = kind === "EMAIL";
  const valueName = isEmail ? "emailValue" : "phoneValue";
  const labelName = isEmail ? "emailLabel" : "phoneLabel";
  const primaryName = isEmail ? "emailPrimary" : "phonePrimary";

  return (
    <Field label={isEmail ? "Emails" : "Phones"}>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={row.key} className="flex flex-wrap items-center gap-2">
            <Input
              name={valueName}
              type={isEmail ? "email" : "tel"}
              value={row.value}
              onChange={(event) =>
                onUpdate(row.key, "value", event.target.value)
              }
              placeholder={isEmail ? "name@example.com" : "(555) 555-5555"}
              className="min-w-0 flex-1"
            />
            <Input
              name={labelName}
              value={row.label}
              onChange={(event) =>
                onUpdate(row.key, "label", event.target.value)
              }
              placeholder="Label (optional)"
              className="w-36"
            />
            <label className="inline-flex items-center gap-1 text-xs text-zinc-600 whitespace-nowrap">
              <input
                type="radio"
                name={primaryName}
                value={index}
                checked={row.isPrimary}
                onChange={() => onPrimary(row.key)}
              />
              Primary
            </label>
            <button
              type="button"
              onClick={() => onRemove(row.key)}
              className="text-xs text-zinc-500 underline hover:text-zinc-900"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAdd}
          className="text-sm text-zinc-700 underline hover:text-zinc-900"
        >
          + Add {isEmail ? "email" : "phone"}
        </button>
      </div>
    </Field>
  );
}
