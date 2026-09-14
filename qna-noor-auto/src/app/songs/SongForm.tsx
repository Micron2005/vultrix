import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { SONG_STAGES } from "@/lib/songs";

export function SongForm({
  action,
  song,
}: {
  action: (formData: FormData) => void | Promise<void>;
  song?: Partial<{
    title: string;
    stage: string;
    musicalKey: string | null;
    bpm: number | null;
    genre: string | null;
    collaborators: string | null;
    notes: string | null;
  }>;
}) {
  return (
    <form action={action} className="max-w-2xl space-y-4">
      <Field label="Title"><Input name="title" required defaultValue={song?.title ?? ""} /></Field>
      <Field label="Stage">
        <Select name="stage" defaultValue={song?.stage ?? "IDEA"}>
          {SONG_STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Key"><Input name="musicalKey" placeholder="C minor" defaultValue={song?.musicalKey ?? ""} /></Field>
        <Field label="BPM"><Input name="bpm" type="number" min="1" max="999" defaultValue={song?.bpm ?? ""} /></Field>
        <Field label="Genre"><Input name="genre" defaultValue={song?.genre ?? ""} /></Field>
        <Field label="Collaborators"><Input name="collaborators" defaultValue={song?.collaborators ?? ""} /></Field>
      </div>
      <Field label="Notes"><Textarea name="notes" rows={5} defaultValue={song?.notes ?? ""} /></Field>
      <Button type="submit">Save song</Button>
    </form>
  );
}
