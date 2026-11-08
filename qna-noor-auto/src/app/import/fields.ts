export type LogicalField =
  | "firstName"
  | "lastName"
  | "fullName"
  | "companyName"
  | "email"
  | "phone"
  | "altPhone"
  | "street"
  | "city"
  | "state"
  | "zip"
  | "customerNotes"
  | "vin"
  | "year"
  | "make"
  | "model"
  | "licensePlate"
  | "unitNumber"
  | "mileage"
  | "vehicleNotes";

export type ColumnMap = Partial<Record<LogicalField, string>>;

export const LOGICAL_FIELDS: {
  key: LogicalField;
  label: string;
  group: "customer" | "vehicle";
}[] = [
  { key: "firstName", label: "First name", group: "customer" },
  { key: "lastName", label: "Last name", group: "customer" },
  { key: "fullName", label: "Full name (if single column)", group: "customer" },
  { key: "companyName", label: "Company name", group: "customer" },
  { key: "email", label: "Email", group: "customer" },
  { key: "phone", label: "Phone", group: "customer" },
  { key: "altPhone", label: "Alt phone", group: "customer" },
  { key: "street", label: "Street", group: "customer" },
  { key: "city", label: "City", group: "customer" },
  { key: "state", label: "State", group: "customer" },
  { key: "zip", label: "ZIP", group: "customer" },
  { key: "customerNotes", label: "Customer notes", group: "customer" },
  { key: "vin", label: "VIN", group: "vehicle" },
  { key: "year", label: "Year", group: "vehicle" },
  { key: "make", label: "Make", group: "vehicle" },
  { key: "model", label: "Model", group: "vehicle" },
  { key: "licensePlate", label: "License plate", group: "vehicle" },
  { key: "unitNumber", label: "Fleet / unit number", group: "vehicle" },
  { key: "mileage", label: "Mileage", group: "vehicle" },
  { key: "vehicleNotes", label: "Vehicle notes", group: "vehicle" },
];

export type ImportType = "customers" | "money" | "calendar";

export type MappedImportField = {
  key: string;
  label: string;
  hints: RegExp[];
};

export const MONEY_IMPORT_FIELDS: MappedImportField[] = [
  { key: "date", label: "Date (required)", hints: [/date|posted|transaction date/i] },
  { key: "description", label: "Description", hints: [/description|payee|merchant|name|memo/i] },
  { key: "amount", label: "Amount", hints: [/^amount$|transaction amount/i] },
  { key: "debit", label: "Debit", hints: [/debit|withdrawal/i] },
  { key: "credit", label: "Credit", hints: [/credit|deposit/i] },
  { key: "type", label: "Type", hints: [/^type$|transaction type/i] },
  { key: "category", label: "Category", hints: [/category/i] },
  { key: "note", label: "Note", hints: [/note|memo/i] },
];

export const CALENDAR_IMPORT_FIELDS: MappedImportField[] = [
  { key: "title", label: "Title (required)", hints: [/title|subject|event|summary/i] },
  { key: "startDate", label: "Start date (required)", hints: [/start.*date|^date$|day/i] },
  { key: "startTime", label: "Start time", hints: [/start.*time|^time$/i] },
  { key: "endDate", label: "End date", hints: [/end.*date|finish.*date/i] },
  { key: "endTime", label: "End time", hints: [/end.*time|finish.*time/i] },
  { key: "allDay", label: "All day", hints: [/all.?day|full.?day/i] },
  { key: "notes", label: "Notes", hints: [/notes?|description|memo/i] },
];
