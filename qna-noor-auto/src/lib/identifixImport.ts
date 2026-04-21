/**
 * Parsers for the three Identifix export formats we've seen.
 *
 * A (customers) — header: Prefix, FirstName, LastName, Suffix, PhoneNo1,
 *   PhoneNo2, PhoneNo3, Email1, Email2, Address1, Address2, IsCompany,
 *   IsTaxExempt, TaxExemptId, Id, CreatedBy, Created
 *
 * B (vehicles) — header: AcesId, SynthesizedId, VIN, LicenseCountry,
 *   LicensePlate, LicenseState, OdometerUnitOfMeasure, UnitNumber, Year,
 *   Make, Model, Engine, Color, Description, CustomerId, Id, CreatedBy,
 *   Created
 *
 * C (invoices) — multi-row format, one invoice per block:
 *     Invoice:,005490
 *     Date:,4/20/2026
 *     Customer:,DERRICK WILLIAMS
 *     Phone:,5408508962
 *     Vin:,3N1BC13E19L355808
 *     Vehicle:,"2009 Nissan Versa S …"
 *     License:,UAB2353
 *     Odometer:,178648
 *     Customer Notes:,,
 *     Technician(s):,Marcus Rodrigos
 *     Number,Type,Part#/Op Code/Tax Option,Description,Quantity,Unit Price,Total Cost
 *     1,Labor,,…,3,$129.00,$387.00
 *     ,,,,,Job Total: ,$387.00
 *     (repeats per job)
 *     ,,,,,Parts,$26.16
 *     ,,,,,Labor,$445.70
 *     ,,,,,Tax,$2.18
 *     ,,,,,Grand Total,$512.43
 *     ,,,,,Balance Due,$0.00
 */

export type ParsedCustomer = {
  externalId: string;
  type: "INDIVIDUAL" | "BUSINESS";
  firstName: string;
  lastName: string;
  companyName: string | null;
  phone: string | null;
  altPhone: string | null;
  email: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

export type ParsedVehicle = {
  externalId: string;
  customerExternalId: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  engine: string | null;
  color: string | null;
  licensePlate: string | null;
  licenseState: string | null;
  mileage: number | null; // not in B, always null
};

export type ParsedInvoice = {
  invoiceNumber: string;
  date: string | null;
  customerName: string | null;
  phone: string | null;
  vin: string | null;
  vehicleDescription: string | null;
  licensePlate: string | null;
  odometer: number | null;
  customerNotes: string | null;
  technicians: string[];
  jobs: {
    lines: {
      type: string;
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }[];
    jobTotal: number;
  }[];
  totals: {
    parts: number;
    labor: number;
    tax: number;
    shopSupplies: number;
    fees: number;
    discount: number;
    grandTotal: number;
    paid: number;
    balanceDue: number;
  };
};

function clean(s: string | undefined | null): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t) return null;
  // strip leading BOM if present
  return t.replace(/^\uFEFF/, "");
}

function cleanBom(s: string): string {
  return s.replace(/^\uFEFF/, "");
}

/**
 * Identifix packs full address into Address1 as a single string, e.g.
 * "3803 LARAMIE PL ALEXANDRIA Virginia 22309".
 * We take a best-effort split — not perfect but better than a blob in street.
 */
function splitAddress(
  address1: string | null,
  address2: string | null,
): { street: string | null; city: string | null; state: string | null; zip: string | null } {
  if (!address1) {
    return {
      street: address2 ?? null,
      city: null,
      state: null,
      zip: null,
    };
  }
  const s = [address1, address2].filter(Boolean).join(" ").trim();
  // Pull trailing 5- or 9-digit zip
  let rest = s;
  let zip: string | null = null;
  const zipMatch = rest.match(/\b(\d{5}(?:-\d{4})?)\s*$/);
  if (zipMatch) {
    zip = zipMatch[1];
    rest = rest.slice(0, -zipMatch[0].length).trim();
  }
  // Pull trailing state (2-letter abbr or full word-list)
  const stateAbbr: Record<string, string> = {
    alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR",
    california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
    florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
    illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
    kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
    massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
    missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
    "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
    "new york": "NY", "north carolina": "NC", "north dakota": "ND",
    ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
    "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
    tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
    virginia: "VA", washington: "WA", "west virginia": "WV",
    wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
  };
  let state: string | null = null;
  const lower = rest.toLowerCase();
  let matched = false;
  for (const [full, abbr] of Object.entries(stateAbbr)) {
    if (lower.endsWith(" " + full) || lower === full) {
      state = abbr;
      rest = rest.slice(0, rest.length - full.length).trim();
      matched = true;
      break;
    }
  }
  if (!matched) {
    const stAbbrMatch = rest.match(/\b([A-Z]{2})\s*$/);
    if (stAbbrMatch && Object.values(stateAbbr).includes(stAbbrMatch[1])) {
      state = stAbbrMatch[1];
      rest = rest.slice(0, -stAbbrMatch[0].length).trim();
    }
  }
  // Remainder = "STREET CITY". We heuristically split on the LAST two tokens =
  // city (many cities are one word; fall back to everything-before-last as
  // street, last word as city).
  let street: string | null = null;
  let city: string | null = null;
  const tokens = rest.split(/\s+/);
  if (tokens.length >= 2) {
    // Try: street is everything up to the street-type keyword (ST/RD/AVE/BLVD
    // /DR/LN/CT/WAY/PL/HWY/TRL/PKWY/CIR/TER/SQ), city is after.
    const streetWords = /^(ST|RD|AVE|AV|BLVD|DR|LN|CT|WAY|PL|HWY|TRL|PKWY|CIR|TER|SQ|ROAD|STREET|AVENUE|DRIVE|LANE|COURT|BOULEVARD|HIGHWAY)\.?$/i;
    let splitAt = -1;
    for (let i = 1; i < tokens.length - 1; i++) {
      if (streetWords.test(tokens[i])) {
        splitAt = i + 1;
        break;
      }
    }
    if (splitAt > 0 && splitAt < tokens.length) {
      street = tokens.slice(0, splitAt).join(" ");
      city = tokens.slice(splitAt).join(" ");
    } else {
      // fallback: last token = city, rest = street
      city = tokens[tokens.length - 1];
      street = tokens.slice(0, -1).join(" ");
    }
  } else {
    street = rest || null;
  }
  return {
    street: street || null,
    city: city || null,
    state,
    zip,
  };
}

/** Parse A.csv (customers). Input is the rows from papaparse header-mode. */
export function parseCustomers(
  rows: Record<string, string>[],
): { customers: ParsedCustomer[]; errors: string[] } {
  const customers: ParsedCustomer[] = [];
  const errors: string[] = [];
  for (const raw of rows) {
    const row: Record<string, string> = {};
    for (const k of Object.keys(raw)) row[cleanBom(k).trim()] = raw[k];

    const id = clean(row["Id"]);
    if (!id) continue; // no external id, skip silently (blank row)

    const isCompany =
      String(row["IsCompany"] ?? "")
        .trim()
        .toUpperCase() === "TRUE";

    const firstName = clean(row["FirstName"]) ?? "";
    const lastName = clean(row["LastName"]) ?? "";
    const prefix = clean(row["Prefix"]);
    const suffix = clean(row["Suffix"]);

    let resolvedFirst = firstName;
    let resolvedLast = lastName;
    let companyName: string | null = null;
    let type: "INDIVIDUAL" | "BUSINESS" = "INDIVIDUAL";

    if (isCompany) {
      type = "BUSINESS";
      // For businesses, the company name is parked in FirstName column.
      // Sometimes it's formatted "COMPANY NAME (CONTACT NAME)" — pull the
      // contact out if present.
      companyName = [firstName, lastName].filter(Boolean).join(" ").trim();
      const contactMatch = companyName.match(/^(.*?)\(\s*([^)]+)\s*\)\s*$/);
      if (contactMatch) {
        companyName = contactMatch[1].trim();
        const contactParts = contactMatch[2].trim().split(/\s+/);
        resolvedFirst = contactParts[0] || "";
        resolvedLast = contactParts.slice(1).join(" ") || "";
      } else {
        resolvedFirst = "";
        resolvedLast = "";
      }
      if (!resolvedFirst && !resolvedLast) {
        // Customer schema requires non-empty first/last. Use the company name
        // as lastName fallback so alphabetical sort still puts it in the
        // right place.
        resolvedLast = companyName.slice(0, 60) || "Business";
        resolvedFirst = "";
      }
    } else {
      if (!resolvedFirst && !resolvedLast) {
        errors.push(`Row with Id=${id} has no name — skipped.`);
        continue;
      }
    }

    // Schema requires both first + last to be non-empty strings (length>=1).
    if (!resolvedFirst) resolvedFirst = prefix ?? "";
    if (!resolvedFirst) resolvedFirst = "-";
    if (!resolvedLast) resolvedLast = "-";

    const addr = splitAddress(
      clean(row["Address1"]),
      clean(row["Address2"]),
    );

    customers.push({
      externalId: id,
      type,
      firstName: resolvedFirst,
      lastName: resolvedLast,
      companyName,
      phone: clean(row["PhoneNo1"]),
      altPhone: clean(row["PhoneNo2"]) ?? clean(row["PhoneNo3"]),
      email: clean(row["Email1"]) ?? clean(row["Email2"]),
      street: addr.street,
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
    });
    // Suffix currently has no place in our schema — folded into notes in the
    // future if needed.
    void suffix;
  }
  return { customers, errors };
}

/** Parse B.csv (vehicles). Input is papaparse header-mode rows. */
export function parseVehicles(
  rows: Record<string, string>[],
): { vehicles: ParsedVehicle[]; errors: string[] } {
  const vehicles: ParsedVehicle[] = [];
  const errors: string[] = [];
  for (const raw of rows) {
    const row: Record<string, string> = {};
    for (const k of Object.keys(raw)) row[cleanBom(k).trim()] = raw[k];

    const id = clean(row["Id"]);
    const cid = clean(row["CustomerId"]);
    if (!id) continue;
    if (!cid) {
      errors.push(`Vehicle Id=${id} has no CustomerId — skipped.`);
      continue;
    }

    const yearStr = clean(row["Year"]);
    const year = yearStr ? parseInt(yearStr, 10) || null : null;

    vehicles.push({
      externalId: id,
      customerExternalId: cid,
      vin: clean(row["VIN"])?.toUpperCase() ?? null,
      year,
      make: clean(row["Make"]),
      model: clean(row["Model"]),
      engine: clean(row["Engine"]),
      color: clean(row["Color"]),
      licensePlate: clean(row["LicensePlate"])?.toUpperCase() ?? null,
      licenseState: clean(row["LicenseState"])?.toUpperCase() ?? null,
      mileage: null,
    });
  }
  return { vehicles, errors };
}

/**
 * Parse C.csv (invoice history). The file is not tabular — it's one block of
 * rows per invoice, separated by blank lines. We walk it linearly using state
 * machine semantics.
 *
 * `raw` is the raw CSV text (NOT papaparse-transformed), because we need to
 * preserve row-ordering and empty rows as separators.
 */
export function parseInvoices(raw: string): {
  invoices: ParsedInvoice[];
  errors: string[];
} {
  const errors: string[] = [];
  const invoices: ParsedInvoice[] = [];
  // Naive line splitter. Quote-wrapped fields with embedded commas aren't an
  // issue here because the file format is "key,value" style and the value
  // field is always the 2nd column (quoted multi-line values like
  // "6.0L, V8, USA/Canada" are fine because we only look at column-index
  // boundaries).
  // Use papaparse's tokenizer via csv.parse-style manual walk. To avoid a
  // dependency here we split lines on \r?\n but keep quoted commas intact by
  // walking char-by-char.
  const lines = tokenizeCsv(raw);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line || line.every((x) => !x || !x.trim())) {
      i++;
      continue;
    }
    if ((line[0] ?? "").trim() !== "Invoice:") {
      i++;
      continue;
    }

    const inv: ParsedInvoice = {
      invoiceNumber: (line[1] ?? "").trim(),
      date: null,
      customerName: null,
      phone: null,
      vin: null,
      vehicleDescription: null,
      licensePlate: null,
      odometer: null,
      customerNotes: null,
      technicians: [],
      jobs: [],
      totals: {
        parts: 0,
        labor: 0,
        tax: 0,
        shopSupplies: 0,
        fees: 0,
        discount: 0,
        grandTotal: 0,
        paid: 0,
        balanceDue: 0,
      },
    };
    i++;

    // Header section. Pull known keys until we hit the line-items table
    // header (starts with "Number,Type,...").
    let parsingJob: ParsedInvoice["jobs"][number] | null = null;
    let expectingLines = false;
    let expectingTechs = false;

    while (i < lines.length) {
      const l = lines[i];
      if (!l) {
        i++;
        continue;
      }
      const key = (l[0] ?? "").trim();
      const val = (l[1] ?? "").trim();

      if (key === "Invoice:") {
        // Next invoice — break out so outer loop re-enters.
        break;
      }

      if (key === "Date:") {
        inv.date = val || null;
        expectingTechs = false;
      } else if (key === "Customer:") {
        inv.customerName = val || null;
        expectingTechs = false;
      } else if (key === "Phone:") {
        inv.phone = val || null;
        expectingTechs = false;
      } else if (key === "Vin:") {
        inv.vin = (val || "").toUpperCase() || null;
        expectingTechs = false;
      } else if (key === "Vehicle:") {
        inv.vehicleDescription = val || null;
        expectingTechs = false;
      } else if (key === "License:") {
        inv.licensePlate = (val || "").toUpperCase() || null;
        expectingTechs = false;
      } else if (key === "Odometer:") {
        inv.odometer = val ? parseInt(val.replace(/[^0-9]/g, ""), 10) || null : null;
        expectingTechs = false;
      } else if (key === "Customer Notes:") {
        inv.customerNotes = val || null;
        expectingTechs = false;
      } else if (key === "Technician(s):") {
        if (val) inv.technicians.push(val);
        expectingTechs = true;
      } else if (key === "Number" && (l[1] ?? "").trim() === "Type") {
        // Line-items table header — next rows are job lines until Job Total.
        parsingJob = { lines: [], jobTotal: 0 };
        expectingLines = true;
        expectingTechs = false;
      } else if (expectingLines && parsingJob && key) {
        // A numbered job line. Columns:
        //   Number, Type, Part#/OpCode/TaxOption, Description, Qty, Unit Price, Total
        const lineType = (l[1] ?? "").trim();
        const description = (l[3] ?? "").trim();
        const qty = parseFloat((l[4] ?? "").trim()) || 0;
        const unit = parseMoney(l[5] ?? "");
        const total = parseMoney(l[6] ?? "");
        parsingJob.lines.push({
          type: lineType,
          description,
          quantity: qty,
          unitPrice: unit,
          total,
        });
      } else if (
        expectingLines &&
        parsingJob &&
        !key &&
        (l[5] ?? "").trim().startsWith("Job Total")
      ) {
        parsingJob.jobTotal = parseMoney(l[6] ?? "");
        inv.jobs.push(parsingJob);
        parsingJob = null;
        expectingLines = false;
      } else if (!key && (l[5] ?? "").trim() === "Parts") {
        inv.totals.parts = parseMoney(l[6] ?? "");
      } else if (!key && (l[5] ?? "").trim() === "Labor") {
        inv.totals.labor = parseMoney(l[6] ?? "");
      } else if (!key && (l[5] ?? "").trim() === "Tax") {
        inv.totals.tax = parseMoney(l[6] ?? "");
      } else if (
        !key &&
        (l[5] ?? "").trim().toLowerCase().startsWith("shop supplies")
      ) {
        inv.totals.shopSupplies = parseMoney(l[6] ?? "");
      } else if (!key && (l[5] ?? "").trim() === "Fees") {
        inv.totals.fees = parseMoney(l[6] ?? "");
      } else if (!key && (l[5] ?? "").trim() === "Discount") {
        inv.totals.discount = parseMoney(l[6] ?? "");
      } else if (!key && (l[5] ?? "").trim() === "Grand Total") {
        inv.totals.grandTotal = parseMoney(l[6] ?? "");
      } else if (!key && (l[5] ?? "").trim().startsWith("Payment")) {
        inv.totals.paid = parseMoney(l[6] ?? "");
      } else if (!key && (l[5] ?? "").trim() === "Balance Due") {
        inv.totals.balanceDue = parseMoney(l[6] ?? "");
      } else if (!key && val && expectingTechs) {
        // Additional technician names
        inv.technicians.push(val);
      }
      i++;
    }

    if (inv.invoiceNumber) invoices.push(inv);
  }

  return { invoices, errors };
}

function parseMoney(s: string): number {
  const cleaned = String(s ?? "")
    .replace(/[$,\s]/g, "")
    .trim();
  if (!cleaned) return 0;
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}

/** Minimal CSV tokenizer — preserves empty rows and quoted commas. */
function tokenizeCsv(raw: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let idx = 0; idx < raw.length; idx++) {
    const ch = raw[idx];
    if (inQuote) {
      if (ch === '"') {
        if (raw[idx + 1] === '"') {
          cur += '"';
          idx++;
        } else {
          inQuote = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ",") {
        row.push(cur);
        cur = "";
      } else if (ch === "\r") {
        // swallow — \n handles line
      } else if (ch === "\n") {
        row.push(cur);
        cur = "";
        out.push(row);
        row = [];
      } else {
        cur += ch;
      }
    }
  }
  if (cur || row.length) {
    row.push(cur);
    out.push(row);
  }
  return out;
}
