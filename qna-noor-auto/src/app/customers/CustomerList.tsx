import Link from "next/link";
import { Card, EmptyState, Input, LinkButton } from "@/components/ui";
import { fullName } from "@/lib/utils";

type Row = {
  id: string;
  type: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  _count: { vehicles: number; repairOrders: number };
};

function sortKey(c: Row): string {
  if (c.type === "BUSINESS" && c.companyName) return c.companyName;
  return `${c.lastName} ${c.firstName}`;
}

function firstChar(s: string): string {
  const ch = (s.trim()[0] ?? "#").toUpperCase();
  return /[A-Z]/.test(ch) ? ch : "#";
}

export function CustomerList({
  kind,
  customers,
  query,
  newHref,
  searchPath,
}: {
  kind: "INDIVIDUAL" | "BUSINESS";
  customers: Row[];
  query: string;
  newHref: string;
  searchPath: string;
}) {
  const isBiz = kind === "BUSINESS";
  const labelSingular = isBiz ? "Business" : "Customer";
  const labelPlural = isBiz ? "Businesses" : "Customers";

  const sorted = [...customers].sort((a, b) =>
    sortKey(a).localeCompare(sortKey(b), undefined, { sensitivity: "base" }),
  );

  const sections = new Map<string, Row[]>();
  for (const c of sorted) {
    const letter = firstChar(sortKey(c));
    if (!sections.has(letter)) sections.set(letter, []);
    sections.get(letter)!.push(c);
  }
  const letters = Array.from(sections.keys());

  return (
    <>
      <form className="mb-3 max-w-md" method="GET" action={searchPath}>
        <Input
          name="q"
          defaultValue={query}
          placeholder={
            isBiz
              ? "Search company, contact, phone, or email…"
              : "Search name, email, or phone…"
          }
        />
      </form>

      {sorted.length === 0 ? (
        <EmptyState
          title={
            query
              ? `No ${labelPlural.toLowerCase()} matched your search`
              : `No ${labelPlural.toLowerCase()} yet`
          }
          description={
            query
              ? undefined
              : `Add your first ${labelSingular.toLowerCase()} to get started.`
          }
          action={<LinkButton href={newHref}>Add {labelSingular}</LinkButton>}
        />
      ) : (
        <>
          {letters.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-1 text-xs">
              {letters.map((L) => (
                <a
                  key={L}
                  href={`#letter-${L}`}
                  className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-md bg-white px-2 font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
                >
                  {L}
                </a>
              ))}
            </div>
          )}

          <div className="space-y-4">
            {letters.map((L) => (
              <Card key={L}>
                <div
                  id={`letter-${L}`}
                  className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-600"
                >
                  {L}
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-white text-left text-xs text-zinc-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2 font-medium">
                        {isBiz ? "Company" : "Name"}
                      </th>
                      {isBiz && (
                        <th className="px-4 py-2 font-medium">Contact</th>
                      )}
                      <th className="px-4 py-2 font-medium">Phone</th>
                      <th className="px-4 py-2 font-medium">Email</th>
                      <th className="px-4 py-2 font-medium text-right">
                        Vehicles
                      </th>
                      <th className="px-4 py-2 font-medium text-right">ROs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {sections.get(L)!.map((c) => (
                      <tr key={c.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-2">
                          <Link
                            href={`/customers/${c.id}`}
                            className="font-medium text-zinc-900 hover:underline"
                          >
                            {isBiz
                              ? c.companyName || fullName(c)
                              : fullName(c)}
                          </Link>
                          {!isBiz && c.companyName && (
                            <div className="text-xs text-zinc-500">
                              {c.companyName}
                            </div>
                          )}
                        </td>
                        {isBiz && (
                          <td className="px-4 py-2 text-zinc-600">
                            {fullName(c)}
                          </td>
                        )}
                        <td className="px-4 py-2 text-zinc-600">
                          {c.phone ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-zinc-600">
                          {c.email ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-right text-zinc-600">
                          {c._count.vehicles}
                        </td>
                        <td className="px-4 py-2 text-right text-zinc-600">
                          {c._count.repairOrders}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
