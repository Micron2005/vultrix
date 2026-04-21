import { PageHeader } from "@/components/ui";
import { VehicleSearchClient } from "./VehicleSearchClient";

export const dynamic = "force-dynamic";

export default function VehicleSearchPage() {
  return (
    <>
      <PageHeader
        title="Vehicle Search"
        description="Pick a vehicle by VIN or plate, then browse catalog parts that fit. No customer add required."
      />
      <VehicleSearchClient />
    </>
  );
}
