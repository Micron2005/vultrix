import { Card, PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/session";
import { ExpenseForm } from "../ExpenseForm";
import { createExpense } from "../actions";

export default async function NewExpensePage() {
  const user = await getCurrentUser();

  return (
    <>
      <PageHeader title="New expense" />
      <Card className="p-6">
        <ExpenseForm action={createExpense} accountType={user?.accountType} />
      </Card>
    </>
  );
}
