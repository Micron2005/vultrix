import { PageHeader } from "@/components/ui";
import { LookupClient } from "./LookupClient";

export const dynamic = "force-dynamic";

export default function LookupPage() {
  return (
    <>
      <PageHeader
        title="Lookup"
        description="Decode a VIN via NHTSA or look up a vehicle already in your records by plate. No customer add required."
      />
      <LookupClient />
    </>
  );
}
