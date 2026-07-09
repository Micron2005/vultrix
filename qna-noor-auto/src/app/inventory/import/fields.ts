export type PartField =
  | "name"
  | "partNumber"
  | "category"
  | "unit"
  | "location"
  | "source"
  | "costPrice"
  | "unitPrice"
  | "qtyOnHand"
  | "reorderLevel"
  | "fitsMake"
  | "fitsModel"
  | "fitsYearMin"
  | "fitsYearMax"
  | "description"
  | "notes";

export type PartColumnMap = Partial<Record<PartField, string>>;

export const PART_FIELDS: { key: PartField; label: string; required?: boolean }[] =
  [
    { key: "name", label: "Name", required: true },
    { key: "partNumber", label: "Part number" },
    { key: "category", label: "Category" },
    { key: "unit", label: "Unit (each, qt, L…)" },
    { key: "location", label: "Location / bin" },
    { key: "source", label: "Supplier" },
    { key: "costPrice", label: "Cost ($)" },
    { key: "unitPrice", label: "Price ($)" },
    { key: "qtyOnHand", label: "Qty on hand" },
    { key: "reorderLevel", label: "Reorder level" },
    { key: "fitsMake", label: "Fits make" },
    { key: "fitsModel", label: "Fits model" },
    { key: "fitsYearMin", label: "Fits year from" },
    { key: "fitsYearMax", label: "Fits year to" },
    { key: "description", label: "Description" },
    { key: "notes", label: "Notes" },
  ];

// Header auto-match hints, checked against each CSV/pasted column header.
export const PART_HEADER_HINTS: Record<PartField, RegExp[]> = {
  name: [/^name$/i, /part.*name/i, /description/i, /item/i, /product/i],
  partNumber: [
    /part.*(number|no|#)/i,
    /^part.?#$/i,
    /^p\/?n$/i,
    /^sku$/i,
    /number/i,
  ],
  category: [/categor/i, /type/i, /group/i],
  unit: [/^unit$/i, /uom/i, /measure/i],
  location: [/location/i, /bin/i, /shelf/i, /aisle/i, /rack/i],
  source: [/supplier/i, /vendor/i, /source/i, /brand/i, /manufacturer/i],
  costPrice: [/cost/i, /wholesale/i, /^buy/i],
  unitPrice: [/price/i, /retail/i, /list/i, /^sell/i, /msrp/i],
  qtyOnHand: [/qty/i, /quantity/i, /on.?hand/i, /stock/i, /count/i],
  reorderLevel: [/reorder/i, /min.*(qty|stock|level)/i, /threshold/i],
  fitsMake: [/make/i, /fits.*make/i],
  fitsModel: [/^model$/i, /fits.*model/i],
  fitsYearMin: [/year.*(from|min|start)/i, /from.*year/i, /^year$/i],
  fitsYearMax: [/year.*(to|max|end)/i, /to.*year/i],
  description: [/desc/i, /detail/i, /note.*long/i],
  notes: [/^notes?$/i, /comment/i, /remark/i],
};
