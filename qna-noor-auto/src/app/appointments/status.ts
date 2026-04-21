export function statusBadgeClass(status: string): string {
  switch (status) {
    case "SCHEDULED":
      return "bg-zinc-200 text-zinc-800";
    case "CONFIRMED":
      return "bg-blue-100 text-blue-800";
    case "ARRIVED":
      return "bg-amber-100 text-amber-800";
    case "COMPLETED":
      return "bg-green-100 text-green-800";
    case "CANCELLED":
      return "bg-red-100 text-red-800";
    case "NO_SHOW":
      return "bg-red-200 text-red-900";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}
