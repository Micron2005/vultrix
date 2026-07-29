import type { ReactNode } from "react";

function bulletLine(line: string): string | null {
  const match = line.match(/^(?:- |\* |• )(.*)$/);
  return match ? match[1] : null;
}

export function renderNoteBody(body: string): ReactNode[] {
  const lines = body.split(/\r?\n/);
  const output: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!lines[index].trim()) {
      index += 1;
      continue;
    }
    const firstBullet = bulletLine(lines[index]);
    if (firstBullet !== null) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = bulletLine(lines[index]);
        if (item === null) break;
        items.push(item);
        index += 1;
      }
      output.push(
        <ul key={`list-${index}`} className="list-disc pl-5">
          {items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
        </ul>,
      );
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && bulletLine(lines[index]) === null) {
      paragraph.push(lines[index]);
      index += 1;
    }
    output.push(
      <p key={`paragraph-${index}`} className="whitespace-pre-wrap">{paragraph.join("\n")}</p>,
    );
  }
  return output;
}
