-- AlterTable
ALTER TABLE "RepairOrder" DROP CONSTRAINT "RepairOrder_vehicleId_fkey";
ALTER TABLE "RepairOrder" ALTER COLUMN "vehicleId" DROP NOT NULL;
ALTER TABLE "RepairOrder"
ADD CONSTRAINT "RepairOrder_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
