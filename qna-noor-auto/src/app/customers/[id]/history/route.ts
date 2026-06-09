import { notFound } from "next/navigation";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { computeTotals } from "@/lib/totals";
import { loadAppliedShopFeesForROs } from "@/lib/shopFees";
import { formatDate, formatMoney, fullName, vehicleLabel } from "@/lib/utils";
import { getAllSettings } from "@/lib/shop";
import { computeVehicleReminders } from "@/lib/serviceReminders";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const BOTTOM_MARGIN = 60;

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      if (font.widthOfTextAtSize(w, size) > maxWidth) {
        let chunk = "";
        for (const ch of w) {
          const nc = chunk + ch;
          if (font.widthOfTextAtSize(nc, size) > maxWidth) {
            if (chunk) lines.push(chunk);
            chunk = ch;
          } else {
            chunk = nc;
          }
        }
        line = chunk;
      } else {
        line = w;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const orgId = await requireOrgId();
  const { id } = await params;
  const customer = await db.customer.findFirst({
    where: { id, orgId },
    include: {
      vehicles: { orderBy: { createdAt: "desc" } },
      repairOrders: {
        orderBy: { openedAt: "desc" },
        include: {
          vehicle: true,
          laborLines: { orderBy: { sortOrder: "asc" } },
          partLines: { orderBy: { sortOrder: "asc" } },
          feeLines: { orderBy: { sortOrder: "asc" } },
          payments: true,
        },
      },
    },
  });
  if (!customer) notFound();

  const shopFeesByRO = await loadAppliedShopFeesForROs(
    orgId,
    customer.repairOrders.map((ro) => {
      const t = computeTotals(ro);
      return { id: ro.id, partsSubtotal: t.partsSubtotal, laborSubtotal: t.laborSubtotal };
    }),
  );

  const settings = await getAllSettings(orgId);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.85, 0.85, 0.85);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function ensureSpace(needed: number) {
    if (y - needed < BOTTOM_MARGIN) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      drawHeaderLite(page);
    }
  }

  function drawHeaderLite(p: PDFPage) {
    p.drawText(`${settings.shopName || "QNA / Noor Auto Repair"} — Service history — ${fullName(customer!)}`, {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN + 4,
      size: 9,
      font,
      color: gray,
    });
    p.drawLine({
      start: { x: MARGIN, y: PAGE_HEIGHT - MARGIN - 4 },
      end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - MARGIN - 4 },
      thickness: 0.5,
      color: lightGray,
    });
    y = PAGE_HEIGHT - MARGIN - 18;
  }

  // First page header
  page.drawText(settings.shopName || "QNA / Noor Auto Repair", {
    x: MARGIN,
    y,
    size: 20,
    font: bold,
    color: black,
  });
  y -= 22;
  const contact = [settings.shopAddress, settings.shopPhone, settings.shopEmail]
    .filter(Boolean)
    .join("  ·  ");
  if (contact) {
    page.drawText(contact, { x: MARGIN, y, size: 9, font, color: gray });
    y -= 14;
  }

  const titleText = "SERVICE HISTORY";
  const titleSize = 20;
  const titleWidth = bold.widthOfTextAtSize(titleText, titleSize);
  page.drawText(titleText, {
    x: PAGE_WIDTH - MARGIN - titleWidth,
    y: PAGE_HEIGHT - MARGIN,
    size: titleSize,
    font: bold,
    color: black,
  });
  const dateLabel = `Printed: ${formatDate(new Date())}`;
  const dateWidth = font.widthOfTextAtSize(dateLabel, 9);
  page.drawText(dateLabel, {
    x: PAGE_WIDTH - MARGIN - dateWidth,
    y: PAGE_HEIGHT - MARGIN - 22,
    size: 9,
    font,
    color: gray,
  });

  y -= 6;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: lightGray,
  });
  y -= 16;

  // Customer block
  page.drawText("CUSTOMER", { x: MARGIN, y, size: 9, font: bold, color: gray });
  y -= 12;
  page.drawText(fullName(customer), { x: MARGIN, y, size: 12, font: bold, color: black });
  y -= 14;
  const lines: string[] = [];
  if (customer.phone) lines.push(customer.phone);
  if (customer.email) lines.push(customer.email);
  if (customer.street) lines.push(customer.street);
  const cityLine = [customer.city, customer.state, customer.zip].filter(Boolean).join(" ");
  if (cityLine) lines.push(cityLine);
  for (const l of lines) {
    page.drawText(l, { x: MARGIN, y, size: 10, font, color: black });
    y -= 12;
  }
  y -= 6;

  // Vehicles block
  page.drawText("VEHICLES", { x: MARGIN, y, size: 9, font: bold, color: gray });
  y -= 12;
  if (customer.vehicles.length === 0) {
    page.drawText("No vehicles on file.", { x: MARGIN, y, size: 10, font, color: gray });
    y -= 12;
  } else {
    for (const v of customer.vehicles) {
      const parts = [vehicleLabel(v)];
      if (v.vin) parts.push(`VIN ${v.vin}`);
      if (v.licensePlate) parts.push(`Plate ${v.licensePlate}`);
      if (typeof v.mileage === "number") parts.push(`${v.mileage.toLocaleString()} mi`);
      page.drawText(parts.join("  ·  "), { x: MARGIN, y, size: 10, font, color: black });
      y -= 12;
    }
  }
  y -= 10;

  // Recommended next service, per vehicle
  const reminders = await Promise.all(
    customer.vehicles.map((v) => computeVehicleReminders(orgId, v.id)),
  );
  const dueRows = reminders
    .filter((r): r is NonNullable<typeof r> => r != null)
    .map((r) => ({
      vehicle: r.vehicle,
      due: r.items.filter(
        (i) => i.status === "overdue" || i.status === "soon",
      ),
    }))
    .filter((r) => r.due.length > 0);
  if (dueRows.length > 0) {
    ensureSpace(30);
    page.drawText("RECOMMENDED NEXT SERVICE", {
      x: MARGIN,
      y,
      size: 9,
      font: bold,
      color: gray,
    });
    y -= 14;
    for (const row of dueRows) {
      ensureSpace(14 + row.due.length * 12);
      page.drawText(vehicleLabel(row.vehicle), {
        x: MARGIN,
        y,
        size: 10,
        font: bold,
        color: black,
      });
      y -= 12;
      for (const i of row.due) {
        const tag = i.status === "overdue" ? "Overdue" : "Due soon";
        const line = `  • ${i.interval.label} — ${tag}${i.summary ? ` · ${i.summary}` : ""}`;
        page.drawText(line, { x: MARGIN, y, size: 10, font, color: black });
        y -= 11;
      }
      y -= 4;
    }
    y -= 4;
  }

  // ROs
  page.drawText(`REPAIR HISTORY (${customer.repairOrders.length})`, {
    x: MARGIN,
    y,
    size: 9,
    font: bold,
    color: gray,
  });
  y -= 14;

  if (customer.repairOrders.length === 0) {
    page.drawText("No repair orders yet.", { x: MARGIN, y, size: 10, font, color: gray });
    y -= 12;
  }

  let lifetime = 0;
  for (const ro of customer.repairOrders) {
    const shopFees = shopFeesByRO.get(ro.id) ?? [];
    const totals = computeTotals({ ...ro, shopFees });
    const paid = ro.payments.reduce((s, p) => s + p.amount, 0);
    const balance = Math.max(0, Math.round((totals.total - paid) * 100) / 100);
    lifetime += totals.total;

    // header line per RO
    ensureSpace(40);
    const headerLeft = `RO #${ro.roNumber}  ·  ${formatDate(ro.openedAt)}  ·  ${vehicleLabel(ro.vehicle)}`;
    page.drawText(headerLeft, { x: MARGIN, y, size: 11, font: bold, color: black });
    const statusLabel = ro.status;
    const statusWidth = font.widthOfTextAtSize(statusLabel, 9);
    page.drawText(statusLabel, {
      x: PAGE_WIDTH - MARGIN - statusWidth,
      y,
      size: 9,
      font,
      color: gray,
    });
    y -= 14;

    const detailBlocks: { label: string; text: string | null | undefined }[] = [
      { label: "Complaint", text: ro.complaint },
      { label: "Correction", text: ro.correction },
    ];
    for (const b of detailBlocks) {
      if (!b.text) continue;
      const wrapped = wrapText(b.text, font, 10, PAGE_WIDTH - MARGIN * 2 - 72);
      ensureSpace(12 + wrapped.length * 11);
      page.drawText(`${b.label}:`, { x: MARGIN + 8, y, size: 9, font: bold, color: gray });
      let lineY = y;
      for (const ln of wrapped) {
        page.drawText(ln, { x: MARGIN + 72, y: lineY, size: 10, font, color: black });
        lineY -= 11;
      }
      y = Math.min(y - 12, lineY);
    }

    ensureSpace(14);
    const totalLine = `Total ${formatMoney(totals.total)}  ·  Paid ${formatMoney(paid)}  ·  Balance ${formatMoney(balance)}`;
    const totalWidth = font.widthOfTextAtSize(totalLine, 10);
    page.drawText(totalLine, {
      x: PAGE_WIDTH - MARGIN - totalWidth,
      y,
      size: 10,
      font,
      color: black,
    });
    y -= 10;

    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: lightGray,
    });
    y -= 12;
  }

  ensureSpace(24);
  y -= 6;
  const summary = `Lifetime total across ${customer.repairOrders.length} repair order${customer.repairOrders.length === 1 ? "" : "s"}: ${formatMoney(lifetime)}`;
  const sumWidth = bold.widthOfTextAtSize(summary, 10);
  page.drawText(summary, {
    x: PAGE_WIDTH - MARGIN - sumWidth,
    y,
    size: 10,
    font: bold,
    color: black,
  });

  const bytes = await pdf.save();
  const safeName = `${fullName(customer)}`.replace(/[^A-Za-z0-9_-]/g, "_");
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="history-${safeName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
