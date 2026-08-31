"use client";

export function DeleteSaleButton({
  action,
  saleId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  saleId: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Delete this sale? The money-in entry will be removed and stock will be restored.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={saleId} />
      <button type="submit" className="text-sm text-red-700 hover:underline">
        Delete
      </button>
    </form>
  );
}
