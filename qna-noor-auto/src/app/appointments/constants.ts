export const APPOINTMENT_STATUSES = [
  "REQUESTED",
  "SCHEDULED",
  "CONFIRMED",
  "ARRIVED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
