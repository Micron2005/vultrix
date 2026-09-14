"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui";

type VehicleResult = {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  engine: string | null;
  vin: string | null;
  licensePlate: string | null;
  licenseState: string | null;
  customerName: string | null;
};

function vehicleLabel(vehicle: VehicleResult) {
  return [vehicle.year, vehicle.make, vehicle.model]
    .filter((part) => part != null && part !== "")
    .join(" ") || "Vehicle";
}

export function VehiclePicker() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VehicleResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/intel/vehicles?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          setResults([]);
          return;
        }
        setResults((await response.json()) as VehicleResult[]);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function selectVehicle(vehicle: VehicleResult) {
    const params = new URLSearchParams();
    if (vehicle.year != null) params.set("year", String(vehicle.year));
    if (vehicle.make) params.set("make", vehicle.make);
    if (vehicle.model) params.set("model", vehicle.model);
    if (vehicle.engine) params.set("engine", vehicle.engine);
    if (vehicle.vin) params.set("vin", vehicle.vin);
    setOpen(false);
    router.push(`/intel?${params.toString()}`);
  }

  const hasQuery = query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative z-20">
      <label
        htmlFor="vehicle-intel-picker"
        className="mb-1 block text-xs font-medium text-zinc-500"
      >
        Find one of your vehicles (plate, VIN or customer)
      </label>
      <Input
        id="vehicle-intel-picker"
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          if (value.trim().length < 2) {
            setResults([]);
            setLoading(false);
          }
          setOpen(true);
        }}
        onFocus={() => {
          if (hasQuery) setOpen(true);
        }}
        placeholder="Search your vehicles…"
        autoComplete="off"
      />
      {open && hasQuery && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
          {loading ? (
            <p className="px-3 py-3 text-sm text-zinc-500">Searching…</p>
          ) : results.length > 0 ? (
            <div className="max-h-72 overflow-y-auto py-1">
              {results.map((vehicle) => (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => selectVehicle(vehicle)}
                  className="block w-full px-3 py-2.5 text-left hover:bg-zinc-50"
                >
                  <span className="block text-sm font-medium text-zinc-900">
                    {vehicleLabel(vehicle)}
                  </span>
                  <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                    {vehicle.licensePlate && (
                      <span>
                        Plate{vehicle.licenseState ? ` (${vehicle.licenseState})` : ""}:{" "}
                        {vehicle.licensePlate}
                      </span>
                    )}
                    {vehicle.customerName && (
                      <span>Customer: {vehicle.customerName}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="px-3 py-3 text-sm text-zinc-500">
              No matching vehicle in your system.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
