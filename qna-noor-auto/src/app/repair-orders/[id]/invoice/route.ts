import { notFound } from "next/navigation";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "@/lib/db";
import { computeTotals } from "@/lib/totals";
import { formatDate, formatMoney, fullName, vehicleLabel } from "@/lib/utils";
import { getAllSettings } from "@/lib/shop";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ro = await db.repairOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      vehicle: true,
      laborLines: { orderBy: { sortOrder: "asc" } },
      partLines: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { paidAt: "asc" } },
    },
  });
  if (!ro) notFound();

  const settings = await getAllSettings();
  const totals = computeTotals(ro);

  // Document type: explicit ?type=estimate/invoice override, otherwise based on RO status.
  // ESTIMATE / IN_PROGRESS / COMPLETED => "ESTIMATE". INVOICED / PAID => "INVOICE".
  const url = new URL(req.url);
  const explicit = url.searchParams.get("type");
  const isEstimate =
    explicit === "estimate" ||
    (explicit !== "invoice" &&
      (ro.status === "ESTIMATE" ||
        ro.status === "IN_PROGRESS" ||
        ro.status === "COMPLETED"));
  const docType = isEstimate ? "ESTIMATE" : "INVOICE";

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]); // US Letter
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  let y = 792 - margin;
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.85, 0.85, 0.85);

  // Shop header
  page.drawText(settings.shopName || "QNA / Noor Auto Repair", {
    x: margin,
    y,
    size: 20,
    font: bold,
    color: black,
  });
  y -= 22;
  const contactParts = [
    settings.shopAddress,
    settings.shopPhone,
    settings.shopEmail,
  ].filter(Boolean);
  if (contactParts.length) {
    page.drawText(contactParts.join("  ·  "), {
      x: margin,
      y,
      size: 9,
      font,
      color: gray,
    });
    y -= 14;
  }

  // Document title (ESTIMATE or INVOICE) + RO number (right aligned)
  const invTitle = docType;
  const invTitleSize = 20;
  const invTitleWidth = bold.widthOfTextAtSize(invTitle, invTitleSize);
  page.drawText(invTitle, {
    x: 612 - margin - invTitleWidth,
    y: 792 - margin,
    size: invTitleSize,
    font: bold,
    color: black,
  });
  const roLabel = `RO #${ro.roNumber}`;
  const roLabelSize = 11;
  const roLabelWidth = font.widthOfTextAtSize(roLabel, roLabelSize);
  page.drawText(roLabel, {
    x: 612 - margin - roLabelWidth,
    y: 792 - margin - 22,
    size: roLabelSize,
    font,
    color: gray,
  });
  const dateLabel = `Date: ${formatDate(ro.openedAt)}`;
  const dateLabelWidth = font.widthOfTextAtSize(dateLabel, 9);
  page.drawText(dateLabel, {
    x: 612 - margin - dateLabelWidth,
    y: 792 - margin - 36,
    size: 9,
    font,
    color: gray,
  });

  y -= 18;
  page.drawLine({
    start: { x: margin, y },
    end: { x: 612 - margin, y },
    thickness: 1,
    color: lightGray,
  });
  y -= 18;

  // Bill To
  page.drawText("BILL TO", { x: margin, y, size: 9, font: bold, color: gray });
  page.drawText("VEHICLE", { x: 320, y, size: 9, font: bold, color: gray });
  y -= 14;

  const billTo: string[] = [fullName(ro.customer)];
  if (ro.customer.street) billTo.push(ro.customer.street);
  const cityLine = [ro.customer.city, ro.customer.state, ro.customer.zip]
    .filter(Boolean)
    .join(" ");
  if (cityLine) billTo.push(cityLine);
  if (ro.customer.phone) billTo.push(ro.customer.phone);
  if (ro.customer.email) billTo.push(ro.customer.email);

  const vLines: string[] = [vehicleLabel(ro.vehicle)];
  if (ro.vehicle.vin) vLines.push(`VIN: ${ro.vehicle.vin}`);
  if (ro.vehicle.licensePlate)
    vLines.push(
      `Plate: ${ro.vehicle.licensePlate}${ro.vehicle.licenseState ? ` (${ro.vehicle.licenseState})` : ""}`,
    );
  if (ro.mileageIn) vLines.push(`Mileage in: ${ro.mileageIn.toLocaleString()}`);
  if (ro.mileageOut)
    vLines.push(`Mileage out: ${ro.mileageOut.toLocaleString()}`);

  const blockTop = y;
  for (let i = 0; i < Math.max(billTo.length, vLines.length); i++) {
    if (billTo[i]) {
      page.drawText(billTo[i], {
        x: margin,
        y: blockTop - i * 12,
        size: 10,
        font,
        color: black,
      });
    }
    if (vLines[i]) {
      page.drawText(vLines[i], {
        x: 320,
        y: blockTop - i * 12,
        size: 10,
        font,
        color: black,
      });
    }
  }
  y = blockTop - Math.max(billTo.length, vLines.length) * 12 - 14;

  // 3 C's
  const threeCs: [string, string | null | undefined][] = [
    ["Complaint", ro.complaint],
    ["Cause", ro.cause],
    ["Correction", ro.correction],
  ];
  for (const [label, text] of threeCs) {
    if (!text) continue;
    page.drawText(label.toUpperCase(), {
      x: margin,
      y,
      size: 9,
      font: bold,
      color: gray,
    });
    y -= 12;
    const wrapped = wrapText(text, font, 10, 612 - margin * 2);
    for (const line of wrapped) {
      page.drawText(line, { x: margin, y, size: 10, font, color: black });
      y -= 12;
    }
    y -= 4;
  }

  y -= 4;
  page.drawLine({
    start: { x: margin, y },
    end: { x: 612 - margin, y },
    thickness: 1,
    color: lightGray,
  });
  y -= 16;

  // Labor section
  if (ro.laborLines.length > 0) {
    page.drawText("LABOR", {
      x: margin,
      y,
      size: 9,
      font: bold,
      color: gray,
    });
    y -= 14;
    drawLineHeader(page, y, font, gray, [
      { text: "Description", x: margin },
      { text: "Hours", x: 380, align: "right" },
      { text: "Rate", x: 460, align: "right" },
      { text: "Amount", x: 612 - margin, align: "right" },
    ]);
    y -= 12;
    for (const l of ro.laborLines) {
      page.drawText(l.description, {
        x: margin,
        y,
        size: 10,
        font,
        color: black,
      });
      drawRight(page, l.hours.toString(), 380, y, font, 10, black);
      drawRight(page, formatMoney(l.rate), 460, y, font, 10, black);
      drawRight(
        page,
        formatMoney(l.hours * l.rate),
        612 - margin,
        y,
        font,
        10,
        black,
      );
      y -= 14;
    }
    y -= 6;
  }

  // Parts section
  if (ro.partLines.length > 0) {
    page.drawText("PARTS", {
      x: margin,
      y,
      size: 9,
      font: bold,
      color: gray,
    });
    y -= 14;
    drawLineHeader(page, y, font, gray, [
      { text: "Description", x: margin },
      { text: "Part #", x: 300 },
      { text: "Qty", x: 420, align: "right" },
      { text: "Unit", x: 480, align: "right" },
      { text: "Amount", x: 612 - margin, align: "right" },
    ]);
    y -= 12;
    for (const p of ro.partLines) {
      page.drawText(p.description, {
        x: margin,
        y,
        size: 10,
        font,
        color: black,
      });
      if (p.partNumber) {
        page.drawText(p.partNumber, {
          x: 300,
          y,
          size: 9,
          font,
          color: gray,
        });
      }
      drawRight(page, p.quantity.toString(), 420, y, font, 10, black);
      drawRight(page, formatMoney(p.unitPrice), 480, y, font, 10, black);
      drawRight(
        page,
        formatMoney(p.quantity * p.unitPrice),
        612 - margin,
        y,
        font,
        10,
        black,
      );
      y -= 14;
    }
    y -= 6;
  }

  // Totals (right side)
  page.drawLine({
    start: { x: 360, y },
    end: { x: 612 - margin, y },
    thickness: 1,
    color: lightGray,
  });
  y -= 14;

  const totalsRows: [string, string][] = [
    ["Labor", formatMoney(totals.laborSubtotal)],
    ["Parts", formatMoney(totals.partsSubtotal)],
    ["Subtotal", formatMoney(totals.subtotal)],
  ];
  if (totals.discount > 0)
    totalsRows.push(["Discount", `- ${formatMoney(totals.discount)}`]);
  totalsRows.push([`Tax (${ro.taxRate}%)`, formatMoney(totals.tax)]);

  for (const [label, val] of totalsRows) {
    page.drawText(label, { x: 360, y, size: 10, font, color: gray });
    drawRight(page, val, 612 - margin, y, font, 10, black);
    y -= 14;
  }

  y -= 4;
  page.drawLine({
    start: { x: 360, y },
    end: { x: 612 - margin, y },
    thickness: 1,
    color: black,
  });
  y -= 16;
  page.drawText("TOTAL", { x: 360, y, size: 12, font: bold, color: black });
  drawRight(page, formatMoney(totals.total), 612 - margin, y, bold, 14, black);

  // Payments / balance — invoice only (estimates have no payments yet)
  const paidTotal = ro.payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.round((totals.total - paidTotal) * 100) / 100;
  if (!isEstimate && ro.payments.length > 0) {
    y -= 22;
    page.drawText("PAYMENTS RECEIVED", {
      x: 360,
      y,
      size: 9,
      font: bold,
      color: gray,
    });
    y -= 14;
    for (const p of ro.payments) {
      const line = `${formatDate(p.paidAt)} · ${prettyPdfMethod(p.method)}${
        p.reference ? ` · ${p.reference}` : ""
      }`;
      page.drawText(line, { x: 360, y, size: 9, font, color: black });
      drawRight(page, `- ${formatMoney(p.amount)}`, 612 - margin, y, font, 10, black);
      y -= 12;
    }
    y -= 4;
    page.drawLine({
      start: { x: 360, y },
      end: { x: 612 - margin, y },
      thickness: 1,
      color: black,
    });
    y -= 16;
    const balLabel = balance <= 0 ? "BALANCE DUE" : "BALANCE DUE";
    page.drawText(balLabel, { x: 360, y, size: 12, font: bold, color: black });
    drawRight(
      page,
      formatMoney(balance < 0 ? 0 : balance),
      612 - margin,
      y,
      bold,
      14,
      black,
    );
    if (balance <= 0) {
      y -= 14;
      page.drawText("PAID IN FULL", {
        x: 360,
        y,
        size: 10,
        font: bold,
        color: rgb(0.0, 0.5, 0.0),
      });
    }
  }

  // Footer
  const footer = isEstimate
    ? "Estimate only. Not an invoice. Prices and labor times may change once work is performed."
    : "Thank you for your business.";
  page.drawText(footer, {
    x: margin,
    y: margin,
    size: 9,
    font,
    color: gray,
  });

  const prefix = isEstimate ? "Estimate" : "Invoice";
  const bytes = await pdf.save();
  return new Response(bytes as BlobPart, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${prefix}-RO-${ro.roNumber}.pdf"`,
    },
  });
}

// Helpers
function prettyPdfMethod(m: string): string {
  switch (m) {
    case "CASH":
      return "Cash";
    case "CARD":
      return "Card";
    case "CHECK":
      return "Check";
    case "TRANSFER":
      return "Transfer";
    case "OTHER":
      return "Other";
    default:
      return m;
  }
}

function drawRight(
  page: import("pdf-lib").PDFPage,
  text: string,
  x: number,
  y: number,
  font: import("pdf-lib").PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: x - w, y, size, font, color });
}

function drawLineHeader(
  page: import("pdf-lib").PDFPage,
  y: number,
  font: import("pdf-lib").PDFFont,
  color: ReturnType<typeof rgb>,
  cols: { text: string; x: number; align?: "left" | "right" }[],
) {
  for (const c of cols) {
    if (c.align === "right") {
      drawRight(page, c.text, c.x, y, font, 8, color);
    } else {
      page.drawText(c.text, { x: c.x, y, size: 8, font, color });
    }
  }
}

function wrapText(
  text: string,
  font: import("pdf-lib").PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const w = font.widthOfTextAtSize(candidate, size);
    if (w > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}
