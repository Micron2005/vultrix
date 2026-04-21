import { Button, Card, CardHeader } from "@/components/ui";
import { parseCachedRecalls } from "@/lib/nhtsa";
import { formatDateTime } from "@/lib/utils";
import { refreshRecallsAction } from "../recalls";

export function RecallsCard({
  vehicleId,
  year,
  make,
  model,
  recallsJson,
  recallsFetchedAt,
}: {
  vehicleId: string;
  year: number | null;
  make: string | null;
  model: string | null;
  recallsJson: string | null;
  recallsFetchedAt: Date | null;
}) {
  const cached = parseCachedRecalls(recallsJson);
  const canFetch = Boolean(year && make && model);
  const refresh = refreshRecallsAction.bind(null, vehicleId);

  return (
    <Card className="mb-4">
      <CardHeader
        title={
          cached
            ? `NHTSA recalls (${cached.count})`
            : "NHTSA recalls"
        }
      >
        <form action={refresh}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={!canFetch}
          >
            {recallsFetchedAt ? "Refresh" : "Check now"}
          </Button>
        </form>
      </CardHeader>
      <div className="p-4 text-sm">
        {!canFetch ? (
          <p className="text-zinc-500">
            Add year, make, and model to look up recalls from NHTSA.
          </p>
        ) : !cached ? (
          <p className="text-zinc-500">
            No NHTSA data yet. Click <b>Check now</b> to look up recalls for{" "}
            {year} {make} {model}.
          </p>
        ) : cached.count === 0 ? (
          <p className="text-zinc-600">
            No active recalls for {cached.year} {cached.make} {cached.model}.
            <span className="ml-2 text-xs text-zinc-500">
              Last checked {recallsFetchedAt ? formatDateTime(recallsFetchedAt) : ""}
            </span>
          </p>
        ) : (
          <>
            <p className="text-xs text-zinc-500 mb-3">
              {cached.count} recall{cached.count === 1 ? "" : "s"} from NHTSA ·
              last checked{" "}
              {recallsFetchedAt ? formatDateTime(recallsFetchedAt) : ""}
            </p>
            <ul className="space-y-3">
              {cached.recalls.map((r) => (
                <li
                  key={r.NHTSACampaignNumber}
                  className="rounded-md border border-zinc-200 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        {r.Component ?? "Recall"}
                      </div>
                      <div className="text-xs text-zinc-500 font-mono mt-0.5">
                        Campaign {r.NHTSACampaignNumber}
                        {r.ReportReceivedDate
                          ? ` · ${r.ReportReceivedDate.slice(0, 10)}`
                          : ""}
                      </div>
                    </div>
                    <a
                      href={`https://www.nhtsa.gov/recalls?nhtsaId=${encodeURIComponent(r.NHTSACampaignNumber)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-zinc-600 hover:text-zinc-900 underline whitespace-nowrap"
                    >
                      NHTSA →
                    </a>
                  </div>
                  {r.Summary && (
                    <div className="mt-2 text-xs text-zinc-700 whitespace-pre-wrap">
                      <span className="font-semibold text-zinc-800">
                        Summary:
                      </span>{" "}
                      {r.Summary}
                    </div>
                  )}
                  {r.Consequence && (
                    <div className="mt-1 text-xs text-zinc-700 whitespace-pre-wrap">
                      <span className="font-semibold text-zinc-800">
                        Consequence:
                      </span>{" "}
                      {r.Consequence}
                    </div>
                  )}
                  {r.Remedy && (
                    <div className="mt-1 text-xs text-zinc-700 whitespace-pre-wrap">
                      <span className="font-semibold text-zinc-800">
                        Remedy:
                      </span>{" "}
                      {r.Remedy}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}
