"use client";

export function DeleteRoutineButton({
  action,
  routineId,
  title,
  className = "text-sm font-medium text-red-700 underline underline-offset-2 hover:text-red-800",
}: {
  action: (formData: FormData) => void | Promise<void>;
  routineId: string;
  title: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Delete “${title}” permanently? Its items and check-offs are deleted too. This can't be undone.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={routineId} />
      <button type="submit" className={className}>
        Delete
      </button>
    </form>
  );
}
