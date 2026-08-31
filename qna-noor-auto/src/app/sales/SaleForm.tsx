"use client";

import { useMemo, useState } from "react";
import { Field, Input, Textarea } from "@/components/ui";
import { SaveButton } from "@/components/SaveButton";

type SalePart = {
  id: string;
  name: string;
  partNumber: string | null;
  category: string | null;
  unit: string | null;
  costPrice: number | null;
  unitPrice: number | null;
  qtyOnHand: number;
};

type SaleInitial = {
  soldAt: string;
  partId: string | null;
  itemName: string;
  quantity: number;
  unitPrice: number | null;
  unitCost: number | null;
  channel: string | null;
  note: string | null;
};

export function SaleForm({
  action,
  parts,
  initial,
  submitLabel = "Record sale",
}: {
  action: (fd: FormData) => void | Promise<void>;
  parts: SalePart[];
  initial: SaleInitial;
  submitLabel?: string;
}) {
  const initialPart = parts.find((part) => part.id === initial.partId) ?? null;
  const [selectedPartId, setSelectedPartId] = useState(initial.partId ?? "");
  const [partQuery, setPartQuery] = useState(initialPart?.name ?? "");
  const [showPartResults, setShowPartResults] = useState(false);
  const [itemName, setItemName] = useState(initial.itemName);
  const [unitPrice, setUnitPrice] = useState(
    initial.unitPrice == null ? "" : String(initial.unitPrice),
  );
  const [unitCost, setUnitCost] = useState(
    initial.unitCost == null ? "" : String(initial.unitCost),
  );
  const selectedPart = parts.find((part) => part.id === selectedPartId) ?? null;
  const filteredParts = useMemo(() => {
    const query = partQuery.trim().toLowerCase();
    if (!query) return parts.slice(0, 12);
    return parts
      .filter((part) =>
        [part.name, part.partNumber ?? "", part.category ?? ""].some((value) =>
          value.toLowerCase().includes(query),
        ),
      )
      .slice(0, 12);
  }, [partQuery, parts]);

  function choosePart(part: SalePart) {
    setSelectedPartId(part.id);
    setPartQuery(part.name);
    setItemName(part.name);
    setUnitPrice(part.unitPrice == null ? "" : String(part.unitPrice));
    setUnitCost(part.costPrice == null ? "" : String(part.costPrice));
    setShowPartResults(false);
  }

  function chooseUntracked() {
    setSelectedPartId("");
    setPartQuery("");
    setItemName("");
    setUnitPrice("");
    setUnitCost("");
    setShowPartResults(false);
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Date sold">
          <Input type="date" name="soldAt" required defaultValue={initial.soldAt} />
        </Field>
        <Field label="Quantity">
          <Input
            name="quantity"
            required
            inputMode="decimal"
            defaultValue={initial.quantity}
            placeholder="1"
          />
        </Field>
        <Field label="Where / channel">
          <Input
            name="channel"
            defaultValue={initial.channel ?? ""}
            placeholder="Etsy, in person, website…"
          />
        </Field>
      </div>

      <Field label="Product">
        <div className="relative">
          <Input
            value={partQuery}
            onChange={(event) => {
              setPartQuery(event.target.value);
              setSelectedPartId("");
              setShowPartResults(true);
            }}
            onFocus={() => setShowPartResults(true)}
            placeholder="Search your inventory, or choose an untracked item"
            aria-label="Search inventory products"
          />
          {showPartResults && (
            <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg">
              {filteredParts.map((part) => (
                <button
                  type="button"
                  key={part.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choosePart(part)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                >
                  <span className="font-medium text-zinc-900">{part.name}</span>
                  <span className="ml-2 text-xs text-zinc-500">
                    {part.partNumber ? `${part.partNumber} · ` : ""}
                    {part.qtyOnHand} on hand
                  </span>
                </button>
              ))}
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={chooseUntracked}
                className="w-full border-t border-zinc-200 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
              >
                Not in my inventory
              </button>
            </div>
          )}
        </div>
        <input type="hidden" name="partId" value={selectedPartId || "__untracked__"} />
        {selectedPart ? (
          <p className="mt-1 text-xs text-zinc-500">
            Stock will decrease when this sale is saved.
          </p>
        ) : (
          <p className="mt-1 text-xs text-zinc-500">
            Use this for a product you do not track in inventory.
          </p>
        )}
      </Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Item name">
          <Input
            name="itemName"
            required
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
            placeholder="What did you sell?"
          />
        </Field>
        <Field label="Price per item">
          <Input
            name="unitPrice"
            required
            inputMode="decimal"
            value={unitPrice}
            onChange={(event) => setUnitPrice(event.target.value)}
            placeholder="$0.00"
          />
        </Field>
        <Field label="Cost per item (optional)">
          <Input
            name="unitCost"
            inputMode="decimal"
            value={unitCost}
            onChange={(event) => setUnitCost(event.target.value)}
            placeholder="What it cost you"
          />
        </Field>
      </div>

      <Field label="Note">
        <Textarea
          name="note"
          rows={2}
          defaultValue={initial.note ?? ""}
          placeholder="Anything worth remembering about this sale"
        />
      </Field>

      <div className="border-t border-zinc-200 pt-4">
        <SaveButton>{submitLabel}</SaveButton>
      </div>
    </form>
  );
}
