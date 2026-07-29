"use client";

import { Button } from "@/components/ui";

export function DeleteCategoryButton({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Delete this category? Parts will be kept but become uncategorized.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <Button type="submit" variant="danger">
        Delete category
      </Button>
    </form>
  );
}
