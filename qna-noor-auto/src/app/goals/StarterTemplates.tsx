import { applyGoalTemplate } from "./actions";
import type { GoalTemplate } from "@/lib/goalTemplates";

export function StarterTemplates({
  templates,
  activeCount,
}: {
  templates: GoalTemplate[];
  activeCount: number;
}) {
  if (templates.length === 0) return null;
  const content = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <div
          key={template.id}
          className="flex flex-col justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
        >
          <div>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                {template.title}
              </h3>
              <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {template.shape === "number" ? "Number" : "Task"}
              </span>
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {template.blurb}
            </p>
          </div>
          <form action={applyGoalTemplate} className="mt-4">
            <input type="hidden" name="templateId" value={template.id} />
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Add
            </button>
          </form>
        </div>
      ))}
    </div>
  );
  if (activeCount < 3) {
    return (
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Starter ideas
        </h2>
        <p className="mb-3 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Add one and edit it after.
        </p>
        {content}
      </section>
    );
  }
  return (
    <section className="mt-6">
      <details>
        <summary className="cursor-pointer text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Starter ideas ({templates.length})
        </summary>
        <p className="mb-3 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Add one and edit it after.
        </p>
        <div className="mt-3">{content}</div>
      </details>
    </section>
  );
}
