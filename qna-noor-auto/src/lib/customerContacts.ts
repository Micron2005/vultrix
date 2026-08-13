import { db } from "@/lib/db";

type TransactionCallback = Extract<
  Parameters<typeof db.$transaction>[0],
  (client: never) => Promise<unknown>
>;

type CustomerTransaction = Parameters<TransactionCallback>[0];

export type CustomerContactInput = {
  kind: "EMAIL" | "PHONE";
  value: string;
  label?: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

export function contactsFromScalarFields(
  email: string | null,
  phone: string | null,
  altPhone: string | null,
): CustomerContactInput[] {
  return [
    ...(email
      ? [
          {
            kind: "EMAIL" as const,
            value: email,
            label: null,
            isPrimary: true,
            sortOrder: 0,
          },
        ]
      : []),
    ...(phone
      ? [
          {
            kind: "PHONE" as const,
            value: phone,
            label: null,
            isPrimary: true,
            sortOrder: 0,
          },
        ]
      : []),
    ...(altPhone
      ? [
          {
            kind: "PHONE" as const,
            value: altPhone,
            label: null,
            isPrimary: false,
            sortOrder: 1,
          },
        ]
      : []),
  ];
}

/**
 * CustomerContact rows are the source of truth going forward. The scalar
 * Customer email/phone/altPhone columns remain a compatibility mirror for
 * legacy read sites and are updated from the primary contacts on every write.
 */
export async function replaceCustomerContacts(
  tx: CustomerTransaction,
  customerId: string,
  orgId: string,
  contacts: CustomerContactInput[],
) {
  const byKind = (kind: CustomerContactInput["kind"]) =>
    contacts
      .filter((contact) => contact.kind === kind && contact.value.trim())
      .sort((a, b) => a.sortOrder - b.sortOrder);

  const emails = byKind("EMAIL");
  const phones = byKind("PHONE");
  const normalize = (
    rows: CustomerContactInput[],
  ): CustomerContactInput[] => {
    if (rows.length === 0) return [];
    const primaryIndex = rows.findIndex((row) => row.isPrimary);
    return rows.map((row, index) => ({
      ...row,
      value: row.value.trim(),
      label: row.label?.trim() || null,
      isPrimary: index === (primaryIndex >= 0 ? primaryIndex : 0),
      sortOrder: index,
    }));
  };
  const normalizedEmails = normalize(emails);
  const normalizedPhones = normalize(phones);
  const normalized = [...normalizedEmails, ...normalizedPhones];
  const primaryEmail =
    normalized.find((contact) => contact.kind === "EMAIL" && contact.isPrimary)
      ?.value ?? null;
  const primaryPhone =
    normalizedPhones.find((contact) => contact.isPrimary)?.value ?? null;
  const altPhone =
    normalizedPhones.find((contact) => !contact.isPrimary)?.value ?? null;

  await tx.customerContact.deleteMany({ where: { customerId, orgId } });
  if (normalized.length > 0) {
    await tx.customerContact.createMany({
      data: normalized.map((contact) => ({
        customerId,
        orgId,
        kind: contact.kind,
        value: contact.value,
        label: contact.label,
        isPrimary: contact.isPrimary,
        sortOrder: contact.sortOrder,
      })),
    });
  }
  await tx.customer.update({
    where: { id: customerId, orgId },
    data: { email: primaryEmail, phone: primaryPhone, altPhone },
  });
}
