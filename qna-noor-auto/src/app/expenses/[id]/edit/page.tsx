import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Button, Card, PageHeader } from "@/components/ui";
import { ExpenseForm } from "../../ExpenseForm";
import { deleteExpense, updateExpense } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exp = await db.expense.findUnique({ where: { id } });
  if (!exp) notFound();

  const upd = updateExpense.bind(null, exp.id);
  const del = deleteExpense.bind(null, exp.id);

  return (
    <>
      <PageHeader
        title="Edit expense"
        actions={
          <form action={del}>
            <Button type="submit" variant="danger">
              Delete
            </Button>
          </form>
        }
      />
      <Card className="p-6">
        <ExpenseForm
          action={upd}
          initial={{
            amount: exp.amount,
            category: exp.category,
            paidAt: exp.paidAt,
            vendor: exp.vendor,
            reference: exp.reference,
            method: exp.method,
            note: exp.note,
          }}
        />
      </Card>
    </>
  );
}
