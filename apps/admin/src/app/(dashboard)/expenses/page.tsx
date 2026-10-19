"use client";
/**
 * /expenses — expense log. GET /admin/expenses + GET /admin/expenses/total.
 * Create (expenses:write): date, category, amount typed in rupees → paise, description,
 * payee, reference. Delete with confirm.
 */
import { useState } from "react";
import { ApiError, apiDelete, apiGet, apiPost, can } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApiQuery, usePageTitle } from "@/lib/hooks";
import { dateInputToMillis, formatDate, formatINR, millisToDateInput, rupeesToPaise } from "@/lib/format";
import { useToast } from "@/lib/toast";
import type { ExpenseDoc } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Dialog } from "@/components/ui/dialog";

interface ExpenseFormState {
  date: string;
  category: string;
  amount: string;
  description: string;
  payee: string;
  reference: string;
}

function emptyExpenseForm(): ExpenseFormState {
  return { date: millisToDateInput(Date.now()), category: "", amount: "", description: "", payee: "", reference: "" };
}

export default function ExpensesPage() {
  usePageTitle("Expenses");
  const { principal } = useAuth();
  const toast = useToast();
  const canWrite = can(principal, "expenses:write");

  const { data, loading, error, reload } = useApiQuery<ExpenseDoc[]>(() => apiGet("/admin/expenses"));
  const { data: total, reload: reloadTotal } = useApiQuery<{ totalPaise: number }>(() => apiGet("/admin/expenses/total"));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ExpenseFormState>(emptyExpenseForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const category = form.category.trim();
    const description = form.description.trim();
    if (category.length < 2) return void setFormError("Category is required (2+ characters).");
    if (description.length < 2) return void setFormError("Description is required (2+ characters).");
    const amountPaise = rupeesToPaise(form.amount);
    if (Number.isNaN(amountPaise) || amountPaise <= 0) return void setFormError("Amount must be greater than ₹0.");
    const date = dateInputToMillis(form.date);
    if (!Number.isFinite(date) || date <= 0) return void setFormError("Pick a valid date.");

    setSaving(true);
    try {
      await apiPost<ExpenseDoc>("/admin/expenses", {
        date,
        category,
        amountPaise,
        description,
        payee: form.payee.trim() || undefined,
        reference: form.reference.trim() || undefined,
      });
      toast.success("Expense recorded", `${category} · ${formatINR(amountPaise)}`);
      setForm(emptyExpenseForm());
      setDialogOpen(false);
      reload();
      reloadTotal();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(expense: ExpenseDoc) {
    if (!window.confirm(`Delete expense "${expense.category} — ${expense.description.slice(0, 60)}" (${formatINR(expense.amountPaise)})?`)) return;
    setDeletingId(expense.id);
    try {
      await apiDelete(`/admin/expenses/${expense.id}`);
      toast.success("Expense deleted", expense.category);
      reload();
      reloadTotal();
    } catch (err) {
      toast.error("Could not delete expense", err instanceof ApiError ? err.message : "Unexpected error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Operating expenses. Reporting treats expenses as cost inputs — profit itself stays unavailable until landed costs are approved."
        actions={canWrite ? <Button onClick={() => setDialogOpen(true)}>Record expense</Button> : null}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Expense log" subtitle={`${data?.length ?? 0} entries`} />
          {loading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : error ? (
            <ErrorState message={error.message} status={error.status} onRetry={reload} />
          ) : !data || data.length === 0 ? (
            <EmptyState title="No expenses yet" description="Record packaging, freight and other operating costs here." />
          ) : (
            <div className="scroll-slim max-h-[32rem] overflow-y-auto">
              <Table>
                <THead>
                  <TR>
                    <TH scope="col">Date</TH>
                    <TH scope="col">Category</TH>
                    <TH scope="col">Description</TH>
                    <TH scope="col">Payee / Ref</TH>
                    <TH scope="col">Amount</TH>
                    {canWrite ? <TH scope="col">Actions</TH> : null}
                  </TR>
                </THead>
                <TBody>
                  {data.map((x) => (
                    <TR key={x.id}>
                      <TD className="text-ink/70">{formatDate(x.date)}</TD>
                      <TD className="font-medium">
                        {x.category}
                        {x.isDemo ? <span className="ml-2 rounded bg-honey/15 px-1 py-0.5 text-[10px] font-semibold text-honey-dark">DEMO</span> : null}
                      </TD>
                      <TD className="max-w-[18rem] truncate" title={x.description}>
                        {x.description}
                      </TD>
                      <TD className="text-ink/60 text-xs">
                        {[x.payee, x.reference].filter(Boolean).join(" · ") || "—"}
                      </TD>
                      <TD className="font-semibold">{formatINR(x.amountPaise)}</TD>
                      {canWrite ? (
                        <TD>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-700 hover:bg-red-50"
                            loading={deletingId === x.id}
                            onClick={() => void remove(x)}
                          >
                            Delete
                          </Button>
                        </TD>
                      ) : null}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Total" subtitle="All recorded expenses (no date filter)" />
          <CardBody>
            <p className="font-display text-3xl font-semibold text-ink">{total ? formatINR(total.totalPaise) : "—"}</p>
            <p className="mt-1 text-xs text-ink/50">
              Demo records are excluded from live reporting unless the reporting setting includes them.
            </p>
          </CardBody>
        </Card>
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Record expense" description="Amounts are typed in rupees and stored as integer paise.">
        <form className="space-y-3" onSubmit={submit} noValidate>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Date" required htmlFor="expense-date">
              <Input id="expense-date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
            </Field>
            <Field label="Category" required hint='e.g. "packaging", "freight"'>
              <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} maxLength={60} required />
            </Field>
          </div>
          <Field label="Amount (₹)" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="1250.00"
              required
            />
          </Field>
          <Field label="Description" required>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} maxLength={500} required />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Payee">
              <Input value={form.payee} onChange={(e) => setForm((f) => ({ ...f, payee: e.target.value }))} maxLength={120} />
            </Field>
            <Field label="Reference">
              <Input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} maxLength={120} />
            </Field>
          </div>
          {formError ? (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-800">
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save expense
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
