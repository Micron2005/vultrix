import { PrismaClient, type Prisma } from "@prisma/client";
import { DEFAULT_SERVICE_INTERVALS } from "../src/lib/serviceReminders";

const db = new PrismaClient();

/**
 * Phase 3: all demo data belongs to a single starter organization. Ensure it
 * exists and return its id so every seeded record can be scoped to it.
 */
async function ensureSeedOrg(): Promise<string> {
  let org = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) {
    org = await db.organization.create({
      data: { name: "QNA / Noor Auto Repair", status: "ACTIVE" },
    });
    console.log(`Created starter organization "${org.name}" (${org.id}).`);
  }
  return org.id;
}

async function main() {
  const orgId = await ensureSeedOrg();
  // One-time data migration for Phase 13: any existing customer that has a
  // companyName set and is still the default INDIVIDUAL type gets flipped to
  // BUSINESS so they land on the new Businesses tab. Idempotent — re-running
  // the seed on a shop that has already cleaned things up is a no-op.
  await db.customer.updateMany({
    where: { orgId, type: "INDIVIDUAL", NOT: { companyName: null } },
    data: { type: "BUSINESS" },
  });

  // Phase 14: make sure every shop has the default service intervals.
  for (const d of DEFAULT_SERVICE_INTERVALS) {
    await db.serviceInterval.upsert({
      where: { key: d.key },
      create: {
        key: d.key,
        label: d.label,
        everyMiles: d.everyMiles,
        everyMonths: d.everyMonths,
        sortOrder: d.sortOrder,
      },
      update: {},
    });
  }

  const existing = await db.customer.count({ where: { orgId } });
  if (existing > 0) {
    console.log(`Skipping customer seed — ${existing} customers already exist.`);
    await seedShopDefaults(orgId);
    await seedNotesIfEmpty(orgId);
    await seedAppointmentsIfEmpty(orgId);
    await seedTechniciansIfEmpty(orgId);
    await seedInventoryIfEmpty(orgId);
    return;
  }

  // Always seed shop defaults (name, labor rate, tax, etc.) so a fresh
  // production DB is usable out of the box. Demo data (customers/vehicles/ROs)
  // only gets seeded when SEED_DEMO is not explicitly set to "false".
  if (process.env.SEED_DEMO === "false") {
    await seedShopDefaults(orgId);
    console.log("Seeded shop defaults only (SEED_DEMO=false). Skipping demo customers.");
    return;
  }

  await seedShopDefaults(orgId);

  const sarah = await db.customer.create({
    data: {
      orgId,
      type: "INDIVIDUAL",
      firstName: "Sarah",
      lastName: "Johnson",
      phone: "(555) 201-4433",
      email: "sarah.johnson@example.com",
      street: "421 Elm Street",
      city: "Houston",
      state: "TX",
      zip: "77002",
      portalToken: "demo-portal-sarah-johnson-AbCd1234",
      vehicles: {
        create: [
          {
            orgId,
            vin: "1HGCM82633A004352",
            year: 2003,
            make: "Honda",
            model: "Accord",
            engine: "2.4L 4cyl Gasoline",
            color: "Silver",
            licensePlate: "ABC1234",
            licenseState: "TX",
            mileage: 182300,
          },
        ],
      },
    },
    include: { vehicles: true },
  });

  const mike = await db.customer.create({
    data: {
      orgId,
      type: "INDIVIDUAL",
      firstName: "Mike",
      lastName: "Nguyen",
      phone: "(555) 887-1221",
      email: "mike.nguyen@example.com",
      street: "1200 Oak Lane",
      city: "Houston",
      state: "TX",
      zip: "77019",
      vehicles: {
        create: [
          {
            orgId,
            vin: "5YJ3E1EA7KF317000",
            year: 2019,
            make: "Tesla",
            model: "Model 3",
            licensePlate: "EV2019",
            licenseState: "TX",
            mileage: 58200,
          },
          {
            orgId,
            vin: "1FTFW1ET0EFC83927",
            year: 2014,
            make: "Ford",
            model: "F-150",
            licensePlate: "TX4X4R",
            licenseState: "TX",
            mileage: 142000,
          },
        ],
      },
    },
    include: { vehicles: true },
  });

  const acme = await db.customer.create({
    data: {
      orgId,
      type: "BUSINESS",
      firstName: "Alex",
      lastName: "Rivera",
      companyName: "Acme Delivery Co.",
      phone: "(555) 334-9900",
      email: "fleet@acmedelivery.example",
      street: "900 Industrial Dr",
      city: "Houston",
      state: "TX",
      zip: "77029",
      vehicles: {
        create: [
          {
            orgId,
            vin: "1GCCS14X8J8158801",
            year: 2018,
            make: "Chevrolet",
            model: "Express 2500",
            licensePlate: "ACME-01",
            licenseState: "TX",
            mileage: 112400,
          },
        ],
      },
    },
    include: { vehicles: true },
  });

  const carlos = await db.technician.create({
    data: {
      orgId,
      name: "Carlos Rivera",
      initials: "CR",
      defaultRate: 150,
      active: true,
    },
  });
  await db.technician.create({
    data: {
      orgId,
      name: "Dana Kim",
      initials: "DK",
      defaultRate: 135,
      active: true,
    },
  });

  // Seed catalog parts up front so RO #1001 can link its part lines to inventory
  // and demo the auto-deduct flow. Opening qty is set high enough to absorb the
  // RO #1001 use without going negative.
  const brakePads = await db.part.create({
    data: {
      orgId,
      name: "Front brake pad set (ceramic)",
      partNumber: "BP-HD-4352",
      description: "Ceramic front pads, fits 2003–2007 Honda Accord 2.4L",
      source: "NAPA",
      costPrice: 42.0,
      unitPrice: 68.5,
      qtyOnHand: 6,
      reorderLevel: 2,
    },
  });
  await db.stockMove.create({
    data: {
      partId: brakePads.id,
      delta: 6,
      reason: "INITIAL",
      note: "Opening balance",
    },
  });

  const caliperGrease = await db.part.create({
    data: {
      orgId,
      name: "Brake caliper grease",
      partNumber: "LUB-CAL-01",
      description: "High-temp silicone caliper grease, 8oz tube",
      source: "AutoZone",
      costPrice: 4.25,
      unitPrice: 7.99,
      qtyOnHand: 1,
      reorderLevel: 3,
    },
  });
  await db.stockMove.create({
    data: {
      partId: caliperGrease.id,
      delta: 1,
      reason: "INITIAL",
      note: "Opening balance — will show as 'Low' on dashboard",
    },
  });

  // A sample repair order
  const ro1001 = await db.repairOrder.create({
    data: {
      orgId,
      roNumber: 1001,
      customerId: sarah.id,
      vehicleId: sarah.vehicles[0].id,
      status: "IN_PROGRESS",
      complaint: "Squealing noise from front brakes when stopping.",
      cause: "Front brake pads worn past minimum thickness. Rotors still within spec.",
      correction: "Replaced front brake pads. Cleaned and lubricated slide pins.",
      mileageIn: 182300,
      taxRate: 8.25,
      laborLines: {
        create: [
          {
            description: "Replace front brake pads, inspect rotors",
            hours: 1.2,
            rate: 150,
            sortOrder: 1,
            technicianId: carlos.id,
          },
        ],
      },
      partLines: {
        create: [
          {
            partId: brakePads.id,
            description: "Front brake pad set (ceramic)",
            partNumber: "BP-HD-4352",
            quantity: 1,
            costPrice: 42.0,
            unitPrice: 68.5,
            source: "NAPA",
            sortOrder: 1,
          },
          {
            partId: caliperGrease.id,
            description: "Brake caliper grease",
            partNumber: "LUB-CAL-01",
            quantity: 1,
            costPrice: 4.25,
            unitPrice: 7.99,
            source: "AutoZone",
            sortOrder: 2,
          },
        ],
      },
    },
    include: { partLines: true },
  });

  // Backfill stock moves + qty adjustments for the RO #1001 part lines so the
  // demo reflects real auto-deduct behavior on first seed.
  for (const line of ro1001.partLines) {
    if (!line.partId) continue;
    await db.part.update({
      where: { id: line.partId },
      data: { qtyOnHand: { decrement: line.quantity } },
    });
    await db.stockMove.create({
      data: {
        partId: line.partId,
        delta: -line.quantity,
        reason: "USE_RO",
        partLineId: line.id,
      },
    });
  }

  await db.repairOrder.create({
    data: {
      orgId,
      roNumber: 1002,
      customerId: mike.id,
      vehicleId: mike.vehicles[1].id, // F-150
      status: "ESTIMATE",
      complaint: "Check engine light on. Customer says it runs rough at idle.",
      mileageIn: 142000,
      taxRate: 8.25,
      laborLines: {
        create: [
          {
            description: "Diagnostic — retrieve DTCs and evaluate",
            hours: 1.0,
            rate: 150,
            sortOrder: 1,
          },
        ],
      },
    },
  });

  await seedNotesIfEmpty(orgId);
  await seedAppointmentsIfEmpty(orgId);
  await seedPaymentsIfEmpty(orgId);
  await seedTechniciansIfEmpty(orgId);
  await seedInventoryIfEmpty(orgId);
  await seedShareTokensIfEmpty();

  console.log("Seed complete.");
}

async function seedShopDefaults(orgId: string) {
  await db.shopSetting.upsert({
    where: { orgId_key: { orgId, key: "shopName" } },
    create: { orgId, key: "shopName", value: "QNA / Noor Auto Repair" },
    update: {},
  });
  await db.shopSetting.upsert({
    where: { orgId_key: { orgId, key: "defaultLaborRate" } },
    create: { orgId, key: "defaultLaborRate", value: "150" },
    update: {},
  });
  await db.shopSetting.upsert({
    where: { orgId_key: { orgId, key: "defaultTaxRate" } },
    create: { orgId, key: "defaultTaxRate", value: "8.25" },
    update: {},
  });

  // Phase 19: seed default Identifix-style shop fees if no fees exist yet.
  const shopFeeCount = await db.shopFee.count({ where: { orgId } });
  if (shopFeeCount === 0) {
    await db.shopFee.create({
      data: {
        orgId,
        name: "Shop Supplies",
        description: "Shop Supplies",
        partsPercent: 7.5,
        laborPercent: 7.5,
        maxCap: 65,
        taxable: false,
        active: true,
        sortOrder: 1,
      },
    });
    await db.shopFee.create({
      data: {
        orgId,
        name: "Hazardous Materials",
        description: "Hazardous Materials",
        partsPercent: 6,
        laborPercent: 0,
        maxCap: 50,
        taxable: false,
        active: true,
        sortOrder: 2,
      },
    });
    console.log("Seeded default shop fees (Shop Supplies, Hazardous Materials).");
  }
}

async function seedShareTokensIfEmpty() {
  // Give RO #1002 a pre-generated share token so the /e/[token] public route
  // is demoable right after seeding. #1002 is in ESTIMATE status, which is the
  // natural candidate (approve → IN_PROGRESS flip). #1001 is already invoiced.
  const ro1002 = await db.repairOrder.findFirst({
    where: { roNumber: 1002 },
    select: { id: true, shareToken: true },
  });
  if (!ro1002 || ro1002.shareToken) return;
  const { randomBytes } = await import("crypto");
  await db.repairOrder.update({
    where: { id: ro1002.id },
    data: { shareToken: randomBytes(16).toString("base64url") },
  });
  console.log("Seeded share token on RO #1002.");
}

async function seedInventoryIfEmpty(orgId: string) {
  const existing = await db.part.count({ where: { orgId } });
  if (existing > 0) {
    console.log(`Skipping inventory seed — ${existing} catalog parts already exist.`);
    return;
  }
  const brakePads = await db.part.create({
    data: {
      orgId,
      name: "Front brake pad set (ceramic)",
      partNumber: "BP-HD-4352",
      description: "Ceramic front pads, fits 2003–2007 Honda Accord 2.4L",
      source: "NAPA",
      costPrice: 42.0,
      unitPrice: 68.5,
      qtyOnHand: 5,
      reorderLevel: 2,
    },
  });
  await db.stockMove.create({
    data: {
      partId: brakePads.id,
      delta: 5,
      reason: "INITIAL",
      note: "Opening balance",
    },
  });
  const caliperGrease = await db.part.create({
    data: {
      orgId,
      name: "Brake caliper grease",
      partNumber: "LUB-CAL-01",
      description: "High-temp silicone caliper grease, 8oz tube",
      source: "AutoZone",
      costPrice: 4.25,
      unitPrice: 7.99,
      qtyOnHand: 0,
      reorderLevel: 3,
    },
  });
  await db.stockMove.create({
    data: {
      partId: caliperGrease.id,
      delta: 0,
      reason: "INITIAL",
      note: "Opening balance — out of stock, demo 'Low stock' card",
    },
  });
  console.log("Seeded 2 catalog parts.");
}

async function seedTechniciansIfEmpty(orgId: string) {
  const existing = await db.technician.count({ where: { orgId } });
  if (existing > 0) {
    console.log(`Skipping technicians seed — ${existing} already exist.`);
    return;
  }
  const carlos = await db.technician.create({
    data: {
      orgId,
      name: "Carlos Rivera",
      initials: "CR",
      defaultRate: 150,
      active: true,
    },
  });
  await db.technician.create({
    data: {
      orgId,
      name: "Dana Kim",
      initials: "DK",
      defaultRate: 135,
      active: true,
    },
  });

  // Retro-assign any unassigned labor lines on RO #1001 to Carlos, so the
  // "Techs on this job" and dashboard "Hours this week" cards have data.
  const ro1001 = await db.repairOrder.findFirst({ where: { roNumber: 1001 } });
  if (ro1001) {
    await db.laborLine.updateMany({
      where: { repairOrderId: ro1001.id, technicianId: null },
      data: { technicianId: carlos.id },
    });
  }
  console.log("Seeded 2 technicians.");
}

async function seedPaymentsIfEmpty(orgId: string) {
  const existing = await db.payment.count({ where: { orgId } });
  if (existing > 0) {
    console.log(`Skipping payments seed — ${existing} already exist.`);
    return;
  }
  const ro1001 = await db.repairOrder.findFirst({ where: { roNumber: 1001 } });
  if (!ro1001) return;

  // Flip RO #1001 to INVOICED with one partial payment — demos the
  // "money owed" card + outstanding invoices list on a fresh install.
  const now = new Date();
  await db.repairOrder.update({
    where: { id: ro1001.id },
    data: {
      status: "INVOICED",
      startedAt: ro1001.startedAt ?? new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      completedAt: ro1001.completedAt ?? new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      invoicedAt: ro1001.invoicedAt ?? new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  await db.payment.create({
    data: {
      orgId,
      repairOrderId: ro1001.id,
      amount: 100,
      method: "CASH",
      note: "Deposit on pickup",
      paidAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("Seeded 1 example payment + invoiced RO #1001.");
}

async function seedAppointmentsIfEmpty(orgId: string) {
  const existing = await db.appointment.count({ where: { orgId } });
  if (existing > 0) {
    console.log(`Skipping appointments seed — ${existing} already exist.`);
    return;
  }
  const customers = await db.customer.findMany({
    where: { orgId },
    include: { vehicles: true },
    orderBy: { createdAt: "asc" },
  });
  if (customers.length === 0) return;

  // Schedule a few over today and tomorrow so the dashboard + week view show data.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const at = (dayOffset: number, hour: number, minute = 0) => {
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  const [first, second] = customers;
  const data: Prisma.AppointmentCreateManyInput[] = [];

  if (first) {
    data.push({
      orgId,
      customerId: first.id,
      vehicleId: first.vehicles[0]?.id ?? null,
      startsAt: at(0, 9, 30),
      durationMinutes: 60,
      reason: "Oil change + tire rotation",
      status: "CONFIRMED",
    });
  }
  if (second) {
    data.push({
      orgId,
      customerId: second.id,
      vehicleId: second.vehicles[0]?.id ?? null,
      startsAt: at(0, 13, 0),
      durationMinutes: 90,
      reason: "Check engine light diagnostic",
      notes: "Customer says it started last Tuesday after a cold start.",
      status: "SCHEDULED",
    });
    data.push({
      orgId,
      customerId: second.id,
      vehicleId: second.vehicles[1]?.id ?? second.vehicles[0]?.id ?? null,
      startsAt: at(1, 10, 0),
      durationMinutes: 120,
      reason: "Brake pad replacement (front)",
      status: "SCHEDULED",
    });
  }

  if (data.length > 0) {
    await db.appointment.createMany({ data });
    console.log(`Seeded ${data.length} example appointments.`);
  }
}

async function seedNotesIfEmpty(orgId: string) {
  const existing = await db.repairNote.count({ where: { orgId } });
  if (existing > 0) {
    console.log(`Skipping notes seed — ${existing} notes already exist.`);
    return;
  }
  await db.repairNote.createMany({
    data: [
      {
        orgId,
        title: "2003–2007 Honda Accord — front brake squeal at low speed",
        yearMin: 2003,
        yearMax: 2007,
        make: "Honda",
        model: "Accord",
        engine: "2.4L K24A4",
        tags: "brakes,noise,honda",
        laborHoursEstimate: 1.2,
        symptom:
          "Squeal from front brakes at low speed under light braking. Goes away when pressing harder.",
        diagnosis:
          "Front brake pad backing glazed from OEM semi-metallic compound. Rotors in spec but mildly scored. No caliper bind.",
        fix:
          "1) Pull front wheels.\n2) Swap front pads for ceramic (NAPA Adaptive One AD465 fits well).\n3) Clean slide pins, re-lube with high-temp caliper grease.\n4) Torque caliper bracket 80 ft-lbs, slide bolts 27 ft-lbs.\n5) Bed-in with 5 medium stops from 40→10 mph.",
        partsNotes:
          "Front pads — NAPA Adaptive One AD465 (~$42 cost). Brake caliper grease — AutoZone Permatex Ultra (~$4).",
      },
      {
        orgId,
        title: "Ford F-150 5.0L — rough idle + P0300 random misfire",
        make: "Ford",
        model: "F-150",
        engine: "5.0L Coyote",
        tags: "misfire,ignition,ford",
        laborHoursEstimate: 1.5,
        symptom:
          "CEL on, P0300 random misfire. Runs rough at idle, smooths out above 1500 rpm.",
        diagnosis:
          "Two coils (cyl 3 and 6) showing high secondary resistance on scope. Plugs at 70k — gap wide, electrode worn.",
        fix:
          "Replace all 8 coil-on-plugs (do a set — don't patch 2). Replace plugs with Motorcraft SP-534 gapped to 0.032\". Clear codes, road test.",
        partsNotes:
          "Coils — Motorcraft DG-521 ×8 (stay OEM, aftermarket fails early). Plugs — Motorcraft SP-534 ×8.",
      },
      {
        orgId,
        title: "Tesla Model 3 — HV battery 12V aux battery failure",
        make: "Tesla",
        model: "Model 3",
        tags: "electrical,battery,tesla",
        laborHoursEstimate: 0.5,
        symptom:
          "Car won't wake up. 'Car needs service' alert on app. 12V aux battery tests low.",
        diagnosis:
          "12V aux battery (under frunk) weak. Common failure on 2019 Model 3s around 2–3 years. HV pack fine.",
        fix:
          "Disconnect HV via service disconnect (under rear seat). Disconnect 12V neg first, then pos. Swap aux battery. Reconnect pos then neg. Reconnect HV. Verify via service menu.",
        partsNotes:
          "Tesla 12V aux battery (P/N 1104715-00-E) — can source OEM or Ohmmu LiFePO4 upgrade.",
      },
    ],
  });
  console.log("Seeded 3 example repair notes.");
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    return db.$disconnect().then(() => process.exit(1));
  });
