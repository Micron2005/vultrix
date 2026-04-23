import { redirect } from "next/navigation";

// Phase 28: /lookup and /vehicle-search were redundant — Lookup's VIN decoder
// and plate-in-records features are already covered by Vehicle Search. We
// keep the /lookup URL alive as a permanent redirect so bookmarks and prior
// links stay valid.
export default function LookupRedirect() {
  redirect("/vehicle-search");
}
