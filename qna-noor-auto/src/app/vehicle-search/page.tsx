import { PageHeader } from "@/components/ui";
import { VehicleSearchClient } from "./VehicleSearchClient";

export const dynamic = "force-dynamic";

export default function VehicleSearchPage() {
  return (
    <>
      <PageHeader
        title="Lookup"
        description="Decode any VIN, or find a vehicle already in your records by plate (your saved customers — not a DMV lookup). Then search your parts catalog; supplier links appear when you don't have the part in stock."
      />
      <VehicleSearchClient />
    </>
  );
}
