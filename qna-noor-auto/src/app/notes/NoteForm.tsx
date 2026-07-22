import { Field, Input, Textarea } from "@/components/ui";
import { SaveButton } from "@/components/SaveButton";
import type { RepairNote } from "@prisma/client";

export function NoteForm({
  action,
  note,
  submitLabel = "Save note",
  accountType = "AUTO_SHOP",
}: {
  action: (fd: FormData) => void | Promise<void>;
  note?: Partial<RepairNote>;
  submitLabel?: string;
  accountType?: string | null;
}) {
  const isAutoShop = accountType === "AUTO_SHOP";

  return (
    <form action={action} className="space-y-8">
      <div className="space-y-4">
        <Field label="Title *">
          <Input
            name="title"
            required
            defaultValue={note?.title ?? ""}
            placeholder={
              isAutoShop
                ? "e.g. 2003-2007 Honda Accord — front brake squeal at low speed"
                : "e.g. Weekly planning checklist"
            }
          />
        </Field>

        {isAutoShop ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Field label="Year from">
                <Input
                  name="yearMin"
                  inputMode="numeric"
                  placeholder="2003"
                  defaultValue={note?.yearMin ?? ""}
                />
              </Field>
              <Field label="Year to">
                <Input
                  name="yearMax"
                  inputMode="numeric"
                  placeholder="2007"
                  defaultValue={note?.yearMax ?? ""}
                />
              </Field>
              <Field label="Make">
                <Input
                  name="make"
                  placeholder="Honda"
                  defaultValue={note?.make ?? ""}
                />
              </Field>
              <Field label="Model">
                <Input
                  name="model"
                  placeholder="Accord"
                  defaultValue={note?.model ?? ""}
                />
              </Field>
              <Field label="Engine">
                <Input
                  name="engine"
                  placeholder="2.4L K24A4"
                  defaultValue={note?.engine ?? ""}
                />
              </Field>
            </div>

            <p className="text-xs text-zinc-500">
              Leave year/make/model blank for a universal note. Otherwise, this
              note will auto-surface on matching vehicles.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Tags (comma-separated)">
                <Input
                  name="tags"
                  placeholder="brakes, noise, honda"
                  defaultValue={note?.tags ?? ""}
                />
              </Field>
              <Field label="Labor hours estimate">
                <Input
                  name="laborHoursEstimate"
                  inputMode="decimal"
                  placeholder="1.5"
                  defaultValue={note?.laborHoursEstimate ?? ""}
                />
              </Field>
            </div>
          </>
        ) : (
          <>
            <Field label="Note / Details">
              <Textarea
                name="fix"
                rows={10}
                placeholder="Write the details you want to remember."
                defaultValue={note?.fix ?? ""}
              />
            </Field>
            <Field label="Tags (comma-separated)">
              <Input
                name="tags"
                placeholder="planning, ideas, reference"
                defaultValue={note?.tags ?? ""}
              />
            </Field>
          </>
        )}
      </div>

      {isAutoShop && (
        <div className="space-y-4 rounded-md border border-zinc-200 p-4 bg-zinc-50">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            The 3 C&apos;s
          </div>
          <Field label="Symptom / Complaint">
            <Textarea
              name="symptom"
              rows={3}
              placeholder="What the customer reports. e.g. 'Squeal from front brakes at low speed under light braking.'"
              defaultValue={note?.symptom ?? ""}
            />
          </Field>
          <Field label="Diagnosis / Cause">
            <Textarea
              name="diagnosis"
              rows={3}
              placeholder="What you found. e.g. 'Front pad backing glazed. Rotors in spec.'"
              defaultValue={note?.diagnosis ?? ""}
            />
          </Field>
          <Field label="Fix / Correction">
            <Textarea
              name="fix"
              rows={5}
              placeholder="Step-by-step what you did. e.g. '1) Pull wheels. 2) Replace front pads with ceramic. 3) Clean + lube slide pins. 4) Torque to 80 ft-lbs.'"
              defaultValue={note?.fix ?? ""}
            />
          </Field>
          <Field label="Parts used / suggested">
            <Textarea
              name="partsNotes"
              rows={3}
              placeholder="e.g. 'Front pads — NAPA Adaptive One AD465. ~$42. Brake caliper grease.'"
              defaultValue={note?.partsNotes ?? ""}
            />
          </Field>
        </div>
      )}

      <div className="flex gap-2">
        <SaveButton>{submitLabel}</SaveButton>
      </div>
    </form>
  );
}
