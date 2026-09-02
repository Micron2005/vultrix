"use client";

export function DeleteGoalButton({
  action,
  goalId,
  title,
  className = "text-sm font-medium text-red-700 underline underline-offset-2 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300",
}: {
  action: (formData: FormData) => void | Promise<void>;
  goalId: string;
  title: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Delete “${title}” permanently? Its check-offs, logged history and any routines under it are deleted too. This can't be undone.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={goalId} />
      <button type="submit" className={className}>
        Delete
      </button>
    </form>
  );
}
