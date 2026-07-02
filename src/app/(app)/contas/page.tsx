import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { BillRow, type Bill } from "@/components/bill-row";
import { BillForm } from "@/components/bill-form";
import { BillsGenerate } from "@/components/bills-generate";
import { ContasCockpit } from "@/components/contas-cockpit";
import {
  getMonthlyBills,
  getCategories,
  getRecurringBillCount,
  getRecurringForecast,
  getIncomeBreakdown,
} from "@/lib/data";
import { monthKey } from "@/lib/utils";

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
}

export default async function ContasPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = sp.month ?? monthKey();
  const isCurrentMonth = month === monthKey();

  const [bills, categories, recurringCount, forecast, income] =
    await Promise.all([
      getMonthlyBills(month),
      getCategories(),
      getRecurringBillCount(),
      getRecurringForecast(),
      getIncomeBreakdown(month),
    ]);

  const nextMonth = shiftMonth(month, 1);

  const total = bills.reduce((s, b) => s + Number(b.amount), 0);
  const sumBy = (st: string) =>
    bills.filter((b) => b.status === st).reduce((s, b) => s + Number(b.amount), 0);

  const totals = {
    total,
    aPagar: sumBy("A_PAGAR"),
    reservado: sumBy("RESERVADO"),
    pago: sumBy("PAGO"),
  };

  const rows: Bill[] = bills.map((b) => ({
    ...b,
    pct: total > 0 ? Number(b.amount) / total : 0,
  }));

  return (
    <div>
      <PageHeader
        title="Contas do mês"
        subtitle="Situação, vencimento e peso de cada conta — como na planilha."
        action={
          <div
            className={`flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5 ${
              isCurrentMonth ? "border-border" : "border-[var(--warning)]/50"
            }`}
          >
            <Link
              href={`/contas?month=${shiftMonth(month, -1)}`}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>

            <div className="flex min-w-44 flex-col items-center leading-tight">
              <span className="text-lg font-semibold capitalize">
                {monthLabel(month)}
              </span>
              {isCurrentMonth ? (
                <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  mês atual
                </span>
              ) : (
                <Link
                  href="/contas"
                  className="text-[10px] font-medium uppercase tracking-wide text-[var(--warning)] hover:underline"
                >
                  ← voltar ao mês atual
                </Link>
              )}
            </div>

            <Link
              href={`/contas?month=${shiftMonth(month, 1)}`}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
        }
      />

      <ContasCockpit
        month={month}
        sources={income.sources}
        totals={totals}
        forecast={forecast}
        nextMonthLabel={monthLabel(nextMonth)}
        nextMonthHref={`/contas?month=${nextMonth}`}
        addBillSlot={
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium">Adicionar conta</h2>
                {recurringCount > 0 && (
                  <BillsGenerate month={month} recurringCount={recurringCount} />
                )}
              </div>
              <BillForm month={month} categories={categories} />
            </CardContent>
          </Card>
        }
      >
        {bills.length === 0 ? (
          <div className="space-y-4 p-8 text-center">
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Nenhuma conta em {monthLabel(month)}. Gere as fixas de uma vez ou
              adicione abaixo.
            </p>
            <div className="flex justify-center">
              <BillsGenerate month={month} recurringCount={recurringCount} />
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground">
              <span className="flex-1">Conta</span>
              <span className="hidden w-16 text-right sm:block">Peso</span>
              <span className="w-28 text-right">Valor</span>
              <span className="w-24 text-center">Situação</span>
              <span className="w-14" />
            </div>
            <div className="divide-y divide-border">
              {rows.map((b) => (
                <BillRow key={b.id} bill={b} categories={categories} />
              ))}
            </div>
          </>
        )}
      </ContasCockpit>
    </div>
  );
}
