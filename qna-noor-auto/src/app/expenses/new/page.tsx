import { Card, PageHeader } from "@/components/ui";
import { ExpenseForm } from "../ExpenseForm";
import { createExpense } from "../actions";

export default function NewExpensePage() {
  return (
    <>
      <PageHeader title="New expense" />
      <Card className="p-6">
        <ExpenseForm action={createExpense} />
      </Card>
    </>
  );
}
