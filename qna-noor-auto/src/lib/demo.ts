// ---------------------------------------------------------------------------
// Live interactive demo sandbox.
//
// Visiting /demo wipes and re-seeds a single, isolated "Vultrix Demo Shop"
// organization with realistic sample data, then drops the visitor straight into
// the real dashboard as that shop's owner. The data resets on every visit, so
// prospects can click around (and even edit) freely without any risk to real
// tenants — it's a safe, self-resetting playground.
//
// Why fixed ids? The org and owner login keep the SAME ids across resets. The
// session cookie embeds the user id, so reusing DEMO_USER_ID means a visitor's
// session stays valid even after another visitor triggers a reset.
// ---------------------------------------------------------------------------

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import {
  DEMO_SIGNATURE_PNG,
  DEMO_PHOTO_BEFORE,
  DEMO_PHOTO_AFTER,
} from "@/lib/demo-assets";

export const DEMO_ORG_ID = "demo-org-vultrix";
export const DEMO_USER_ID = "demo-user-vultrix";
export const DEMO_USERNAME = "vultrix-demo";
export const DEMO_SHOP_NAME = "Vultrix Demo Shop";

/** True when an org id belongs to the demo sandbox. */
export function isDemoOrg(orgId: string | null | undefined): boolean {
  return orgId === DEMO_ORG_ID;
}

function daysFromNow(days: number, hour = 9, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Wipe + re-seed the demo organization. Idempotent and safe to call on every
 * /demo visit. Keeps the org + owner ids stable so existing demo sessions stay
 * valid across resets.
 */
export async function seedDemo(): Promise<void> {
  // 1) Wipe any prior demo data. RepairOrder -> Customer/Vehicle FKs are
  //    ON DELETE RESTRICT, so cascading from the org fails while repair orders
  //    still point at customers. Delete the ROs first (their children cascade),
  //    then the org (which cascades customers, vehicles, parts, users, …).
  const existing = await db.organization.findUnique({
    where: { id: DEMO_ORG_ID },
    select: { id: true },
  });
  if (existing) {
    await db.$transaction([
      db.repairOrder.deleteMany({ where: { orgId: DEMO_ORG_ID } }),
      db.organization.delete({ where: { id: DEMO_ORG_ID } }),
    ]);
  }

  // 2) Fresh org + owner login (fixed ids).
  await db.organization.create({
    data: {
      id: DEMO_ORG_ID,
      name: DEMO_SHOP_NAME,
      status: "ACTIVE",
      subscriptionStatus: "trialing",
      billingEmail: "demo@vultrix.net",
      trialEndsAt: daysFromNow(60),
    },
  });
  await db.user.create({
    data: {
      id: DEMO_USER_ID,
      username: DEMO_USERNAME,
      usernameLower: DEMO_USERNAME.toLowerCase(),
      email: "demo@vultrix.net",
      // Sign-in happens via the demo cookie, never this hash — randomized so
      // it's never a known/guessable credential.
      passwordHash: hashPassword(`demo-${Date.now()}-${Math.random()}`),
      role: "OWNER",
      orgId: DEMO_ORG_ID,
    },
  });

  // 3) Shop profile + fees (so invoices have a complete header).
  await db.shopSetting.createMany({
    data: [
      { orgId: DEMO_ORG_ID, key: "shopName", value: DEMO_SHOP_NAME },
      { orgId: DEMO_ORG_ID, key: "shopAddress", value: "1450 Gear Street, Houston, TX 77002" },
      { orgId: DEMO_ORG_ID, key: "shopPhone", value: "(555) 212-7788" },
      { orgId: DEMO_ORG_ID, key: "shopEmail", value: "service@vultrixdemo.shop" },
      { orgId: DEMO_ORG_ID, key: "defaultLaborRate", value: "150" },
      { orgId: DEMO_ORG_ID, key: "defaultTaxRate", value: "8.25" },
    ],
  });
  await db.shopFee.createMany({
    data: [
      {
        orgId: DEMO_ORG_ID,
        name: "Shop Supplies",
        description: "Shop Supplies",
        partsPercent: 7.5,
        laborPercent: 7.5,
        maxCap: 65,
        taxable: false,
        active: true,
        sortOrder: 1,
      },
      {
        orgId: DEMO_ORG_ID,
        name: "Hazardous Materials",
        description: "Hazardous Materials",
        partsPercent: 6,
        laborPercent: 0,
        maxCap: 50,
        taxable: false,
        active: true,
        sortOrder: 2,
      },
    ],
  });

  // 4) Technicians.
  const carlos = await db.technician.create({
    data: { orgId: DEMO_ORG_ID, name: "Carlos Rivera", initials: "CR", defaultRate: 150, active: true },
  });
  const dana = await db.technician.create({
    data: { orgId: DEMO_ORG_ID, name: "Dana Kim", initials: "DK", defaultRate: 135, active: true },
  });
  await db.technician.create({
    data: { orgId: DEMO_ORG_ID, name: "Marcus Webb", initials: "MW", defaultRate: 140, active: true },
  });

  // 5) Inventory catalog (one low/out-of-stock so the dashboard "Low stock"
  //    card has something to show).
  const brakePads = await db.part.create({
    data: {
      orgId: DEMO_ORG_ID,
      name: "Front brake pad set (ceramic)",
      partNumber: "BP-HD-4352",
      description: "Ceramic front pads — fits 2003–2007 Honda Accord 2.4L",
      source: "NAPA",
      costPrice: 42.0,
      unitPrice: 68.5,
      qtyOnHand: 8,
      reorderLevel: 2,
      fitsMake: "Honda",
      fitsModel: "Accord",
    },
  });
  const rotor = await db.part.create({
    data: {
      orgId: DEMO_ORG_ID,
      name: "Front brake rotor",
      partNumber: "RT-HD-9920",
      description: "Vented front rotor — Honda Accord",
      source: "NAPA",
      costPrice: 38.0,
      unitPrice: 62.0,
      qtyOnHand: 5,
      reorderLevel: 2,
    },
  });
  const oilFilter = await db.part.create({
    data: {
      orgId: DEMO_ORG_ID,
      name: "Oil filter (common)",
      partNumber: "OF-STD-01",
      description: "Standard spin-on oil filter",
      source: "AutoZone",
      costPrice: 4.2,
      unitPrice: 9.99,
      qtyOnHand: 24,
      reorderLevel: 6,
    },
  });
  const caliperGrease = await db.part.create({
    data: {
      orgId: DEMO_ORG_ID,
      name: "Brake caliper grease",
      partNumber: "LUB-CAL-01",
      description: "High-temp silicone caliper grease, 8oz",
      source: "AutoZone",
      costPrice: 4.25,
      unitPrice: 7.99,
      qtyOnHand: 1,
      reorderLevel: 3,
    },
  });
  await db.stockMove.createMany({
    data: [
      { partId: brakePads.id, delta: 8, reason: "INITIAL", note: "Opening balance" },
      { partId: rotor.id, delta: 5, reason: "INITIAL", note: "Opening balance" },
      { partId: oilFilter.id, delta: 24, reason: "INITIAL", note: "Opening balance" },
      { partId: caliperGrease.id, delta: 1, reason: "INITIAL", note: "Opening balance — shows as Low" },
    ],
  });

  // 6) Customers + vehicles.
  const sarah = await db.customer.create({
    data: {
      orgId: DEMO_ORG_ID,
      type: "INDIVIDUAL",
      firstName: "Sarah",
      lastName: "Johnson",
      phone: "(555) 201-4433",
      email: "sarah.johnson@example.com",
      street: "421 Elm Street",
      city: "Houston",
      state: "TX",
      zip: "77002",
      vehicles: {
        create: [
          {
            orgId: DEMO_ORG_ID,
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
      orgId: DEMO_ORG_ID,
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
          { orgId: DEMO_ORG_ID, vin: "5YJ3E1EA7KF317000", year: 2019, make: "Tesla", model: "Model 3", color: "White", licensePlate: "EV2019", licenseState: "TX", mileage: 58200 },
          { orgId: DEMO_ORG_ID, vin: "1FTFW1ET0EFC83927", year: 2014, make: "Ford", model: "F-150", color: "Blue", licensePlate: "TX4X4R", licenseState: "TX", mileage: 142000 },
        ],
      },
    },
    include: { vehicles: true },
  });

  const linda = await db.customer.create({
    data: {
      orgId: DEMO_ORG_ID,
      type: "INDIVIDUAL",
      firstName: "Linda",
      lastName: "Alvarez",
      phone: "(555) 442-0098",
      email: "linda.alvarez@example.com",
      street: "78 Maple Ct",
      city: "Houston",
      state: "TX",
      zip: "77004",
      vehicles: {
        create: [
          { orgId: DEMO_ORG_ID, vin: "2T1BURHE0JC123456", year: 2018, make: "Toyota", model: "Corolla", color: "Gray", licensePlate: "LDA-77", licenseState: "TX", mileage: 64500 },
        ],
      },
    },
    include: { vehicles: true },
  });

  const acme = await db.customer.create({
    data: {
      orgId: DEMO_ORG_ID,
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
          { orgId: DEMO_ORG_ID, vin: "1GCCS14X8J8158801", year: 2018, make: "Chevrolet", model: "Express 2500", color: "White", licensePlate: "ACME-01", licenseState: "TX", mileage: 112400 },
          { orgId: DEMO_ORG_ID, vin: "3C6UR5CL9JG200111", year: 2018, make: "Ram", model: "2500", color: "White", licensePlate: "ACME-02", licenseState: "TX", mileage: 98750 },
        ],
      },
    },
    include: { vehicles: true },
  });

  // 7) Repair orders across the lifecycle.

  // RO #1001 — INVOICED w/ partial payment + signed approval + photos.
  const ro1001 = await db.repairOrder.create({
    data: {
      orgId: DEMO_ORG_ID,
      roNumber: 1001,
      customerId: sarah.id,
      vehicleId: sarah.vehicles[0].id,
      status: "INVOICED",
      complaint: "Squealing noise from front brakes when stopping.",
      cause: "Front brake pads worn past minimum; rotors scored beyond spec.",
      correction: "Replaced front pads and rotors. Cleaned and lubricated slide pins. Road-tested.",
      mileageIn: 182300,
      mileageOut: 182312,
      taxRate: 8.25,
      approvedAt: daysAgo(3),
      startedAt: daysAgo(3),
      completedAt: daysAgo(2),
      invoicedAt: daysAgo(2),
      signatureDataUrl: DEMO_SIGNATURE_PNG,
      signatureName: "Sarah Johnson",
      signedAt: daysAgo(3),
      laborLines: {
        create: [
          { description: "Replace front brake pads & rotors, inspect calipers", hours: 1.8, rate: 150, sortOrder: 1, technicianId: carlos.id },
        ],
      },
      partLines: {
        create: [
          { partId: brakePads.id, description: "Front brake pad set (ceramic)", partNumber: "BP-HD-4352", quantity: 1, costPrice: 42.0, unitPrice: 68.5, source: "NAPA", sortOrder: 1 },
          { partId: rotor.id, description: "Front brake rotor", partNumber: "RT-HD-9920", quantity: 2, costPrice: 38.0, unitPrice: 62.0, source: "NAPA", sortOrder: 2 },
          { partId: caliperGrease.id, description: "Brake caliper grease", partNumber: "LUB-CAL-01", quantity: 1, costPrice: 4.25, unitPrice: 7.99, source: "AutoZone", sortOrder: 3 },
        ],
      },
    },
  });
  await db.payment.create({
    data: {
      orgId: DEMO_ORG_ID,
      repairOrderId: ro1001.id,
      amount: 150,
      method: "CARD",
      note: "Deposit at drop-off",
      paidAt: daysAgo(2),
    },
  });
  await db.repairOrderPhoto.createMany({
    data: [
      { repairOrderId: ro1001.id, orgId: DEMO_ORG_ID, dataUrl: DEMO_PHOTO_BEFORE, caption: "Before — worn front rotor & pads", sortOrder: 1 },
      { repairOrderId: ro1001.id, orgId: DEMO_ORG_ID, dataUrl: DEMO_PHOTO_AFTER, caption: "After — new rotor & ceramic pads", sortOrder: 2 },
    ],
  });

  // RO #1002 — ESTIMATE with a shareable approval link.
  const { randomBytes } = await import("crypto");
  await db.repairOrder.create({
    data: {
      orgId: DEMO_ORG_ID,
      roNumber: 1002,
      customerId: mike.id,
      vehicleId: mike.vehicles[1].id, // F-150
      status: "ESTIMATE",
      complaint: "Check engine light on; runs rough at idle.",
      mileageIn: 142000,
      taxRate: 8.25,
      shareToken: randomBytes(16).toString("base64url"),
      laborLines: {
        create: [
          { description: "Diagnostic — retrieve DTCs and evaluate", hours: 1.0, rate: 150, sortOrder: 1, technicianId: dana.id },
        ],
      },
    },
  });

  // RO #1003 — IN_PROGRESS oil service.
  await db.repairOrder.create({
    data: {
      orgId: DEMO_ORG_ID,
      roNumber: 1003,
      customerId: linda.id,
      vehicleId: linda.vehicles[0].id,
      status: "IN_PROGRESS",
      complaint: "Due for oil change and multipoint inspection.",
      mileageIn: 64500,
      taxRate: 8.25,
      approvedAt: daysAgo(1),
      startedAt: daysAgo(1),
      laborLines: {
        create: [
          { description: "Full synthetic oil & filter change", hours: 0.6, rate: 150, sortOrder: 1, technicianId: dana.id },
          { description: "Multipoint inspection", hours: 0.4, rate: 150, sortOrder: 2, technicianId: dana.id },
        ],
      },
      partLines: {
        create: [
          { partId: oilFilter.id, description: "Oil filter", partNumber: "OF-STD-01", quantity: 1, costPrice: 4.2, unitPrice: 9.99, source: "AutoZone", sortOrder: 1 },
          { description: "Full synthetic 5W-30 (5 qt)", quantity: 5, unitPrice: 8.5, costPrice: 5.1, source: "AutoZone", sortOrder: 2 },
        ],
      },
    },
  });

  // RO #1004 — PAID (counts toward "Revenue this month").
  const ro1004 = await db.repairOrder.create({
    data: {
      orgId: DEMO_ORG_ID,
      roNumber: 1004,
      customerId: acme.id,
      vehicleId: acme.vehicles[0].id,
      status: "PAID",
      complaint: "Fleet van — scheduled service & brake check.",
      cause: "Routine maintenance.",
      correction: "Performed scheduled service; brakes within spec.",
      mileageIn: 112400,
      mileageOut: 112405,
      taxRate: 8.25,
      approvedAt: daysAgo(9),
      startedAt: daysAgo(9),
      completedAt: daysAgo(8),
      invoicedAt: daysAgo(8),
      paidAt: daysAgo(6),
      closedAt: daysAgo(6),
      laborLines: {
        create: [
          { description: "Scheduled fleet service", hours: 2.0, rate: 150, sortOrder: 1, technicianId: carlos.id },
        ],
      },
      partLines: {
        create: [
          { partId: oilFilter.id, description: "Oil filter", partNumber: "OF-STD-01", quantity: 1, costPrice: 4.2, unitPrice: 9.99, source: "AutoZone", sortOrder: 1 },
        ],
      },
    },
  });
  await db.payment.create({
    data: { orgId: DEMO_ORG_ID, repairOrderId: ro1004.id, amount: 365.4, method: "CHECK", reference: "1042", note: "Paid in full", paidAt: daysAgo(6) },
  });

  // 8) Appointments today + tomorrow (drive the dashboard schedule).
  await db.appointment.createMany({
    data: [
      { orgId: DEMO_ORG_ID, customerId: sarah.id, vehicleId: sarah.vehicles[0].id, startsAt: daysFromNow(0, 9, 30), durationMinutes: 60, reason: "Brake follow-up / pickup", status: "CONFIRMED" },
      { orgId: DEMO_ORG_ID, customerId: mike.id, vehicleId: mike.vehicles[1].id, startsAt: daysFromNow(0, 13, 0), durationMinutes: 90, reason: "Check engine light diagnostic", notes: "Started after a cold morning start.", status: "SCHEDULED" },
      { orgId: DEMO_ORG_ID, customerId: linda.id, vehicleId: linda.vehicles[0].id, startsAt: daysFromNow(1, 10, 0), durationMinutes: 45, reason: "Oil change", status: "SCHEDULED" },
      { orgId: DEMO_ORG_ID, customerId: acme.id, vehicleId: acme.vehicles[1].id, startsAt: daysFromNow(1, 14, 30), durationMinutes: 120, reason: "Fleet brake inspection", status: "SCHEDULED" },
    ],
  });

  // 9) Knowledge base notes.
  await db.repairNote.createMany({
    data: [
      {
        orgId: DEMO_ORG_ID,
        title: "2003–2007 Honda Accord — front brake squeal at low speed",
        yearMin: 2003,
        yearMax: 2007,
        make: "Honda",
        model: "Accord",
        engine: "2.4L K24A4",
        tags: "brakes,noise,honda",
        laborHoursEstimate: 1.2,
        symptom: "Squeal from front brakes at low speed under light braking.",
        diagnosis: "Glazed OEM semi-metallic pads; rotors mildly scored.",
        fix: "Swap to ceramic pads, clean/lube slide pins, bed-in with 5 medium stops.",
        partsNotes: "Front pads — ceramic set (~$42 cost). Caliper grease (~$4).",
      },
      {
        orgId: DEMO_ORG_ID,
        title: "Ford F-150 5.0L — rough idle + P0300 random misfire",
        make: "Ford",
        model: "F-150",
        engine: "5.0L Coyote",
        tags: "misfire,ignition,ford",
        laborHoursEstimate: 1.5,
        symptom: "CEL on, P0300, rough at idle, smooths above 1500 rpm.",
        diagnosis: "Two coils high secondary resistance; plugs worn at 70k.",
        fix: "Replace all 8 coils + plugs (Motorcraft). Clear codes, road test.",
        partsNotes: "Coils — Motorcraft DG-521 ×8. Plugs — SP-534 ×8.",
      },
    ],
  });

  // 10) A couple of shop expenses for the Financials page.
  await db.expense.createMany({
    data: [
      { orgId: DEMO_ORG_ID, paidAt: daysAgo(12), amount: 1850, category: "RENT", vendor: "Gear Street Properties", method: "TRANSFER", note: "Monthly shop rent" },
      { orgId: DEMO_ORG_ID, paidAt: daysAgo(5), amount: 240.55, category: "SUPPLIES", vendor: "NAPA", method: "CARD", note: "Shop supplies restock" },
      { orgId: DEMO_ORG_ID, paidAt: daysAgo(2), amount: 89.0, category: "UTILITIES", vendor: "City Power", method: "CARD", note: "Electricity" },
    ],
  });
}
