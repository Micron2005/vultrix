"use client";

export function DeleteMilestoneButton({
  action,
  title,
  className = "text-xs font-medium text-red-700 underline underline-offset-2 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300",
}: {
  action: (formData: FormData) => void | Promise<void>;
  title: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Delete “${title}”? This can't be undone.`)) {
          event.preventDefault();
        }
      }}
    >
      <button type="submit" className={className}>
        Delete
      </button>
    </form>
  );
}
