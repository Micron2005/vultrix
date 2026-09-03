import { Card, CardHeader, LinkButton } from "@/components/ui";
import type { FeatureKey } from "@/lib/features";

export async function QuickAddBlock({
  features,
  salesAvailable,
  title,
}: {
  features: Set<FeatureKey>;
  salesAvailable: boolean;
  title?: string;
}) {
  const links: Array<{ href: string; label: string; requires: FeatureKey[] }> = [
    { href: "/notes/new", label: "New note", requires: ["knowledge"] },
    { href: "/appointments", label: "New event", requires: ["schedule"] },
    { href: "/expenses/income/new", label: "Add income", requires: ["financials"] },
    { href: "/expenses/new", label: "Add expense", requires: ["financials"] },
    ...(salesAvailable
      ? [{ href: "/sales", label: "Record sale", requires: [] as FeatureKey[] }]
      : []),
    { href: "/goals", label: "New goal", requires: [] },
  ];
  const availableLinks = links.filter((link) =>
    link.requires.every((feature) => features.has(feature)),
  );
  return (
    <Card className="mb-6">
      <CardHeader title={title ?? "Quick actions"} />
      <div className="flex flex-wrap gap-2 p-4">
        {availableLinks.map((link) => (
          <LinkButton key={link.href} href={link.href} size="sm">
            {link.label}
          </LinkButton>
        ))}
      </div>
    </Card>
  );
}
