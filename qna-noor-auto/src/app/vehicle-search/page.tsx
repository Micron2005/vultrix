import { PageHeader } from "@/components/ui";
import { VehicleSearchClient } from "./VehicleSearchClient";

export const dynamic = "force-dynamic";

export default function VehicleSearchPage() {
  return (
    <>
      <PageHeader
        title="Lookup"
        description="Pick a vehicle by VIN or plate, then search your parts catalog. Supplier links appear when you don't have the part in stock."
      />
      <VehicleSearchClient />
    </>
  );
}
