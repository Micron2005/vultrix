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
  { key: "mileage", label: "Mileage", group: "vehicle" },
  { key: "vehicleNotes", label: "Vehicle notes", group: "vehicle" },
];
