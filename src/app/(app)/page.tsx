import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { getAccounts, getMonthSummary, getRecentTransactions } from "@/lib/data";
import { formatBRL, formatDate, monthKey } from "@/lib/utils";

const MONTH_LABEL = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
}).format(new Date());

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  INCOME: { label: "Receita", cls: "text-[var(--positive)]" },
  EXPENSE: { label: "Despesa", cls: "text-[var(--negative)]" },
  TRANSFER: { label: "Transferência", cls: "text-muted-foreground" },
};

export default async function DashboardPage() {
  const [summary, accounts, recent] = await Promise.all([
    getMonthSummary(),
    getAccounts(),
    getRecentTransactions(8),
  ]);

  const hasData = accounts.length > 0;

  const cards = [
    { title: "Receitas do mês", value: summary.income, cls: "text-[var(--positive)]" },
    { title: "Gastei (variável)", value: summary.expense, cls: "text-[var(--negative)]" },
    { title: "Saldo do mês", value: summary.net, cls: summary.net >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]" },
    { title: "Saldo em conta", value: summary.cashBalance, cls: "" },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Visão de ${MONTH_LABEL} · ${monthKey()}`}
      />

      {!hasData && (
        <Card className="mb-6">
          <CardContent className="flex flex-col items-start gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Comece criando suas contas e categorias.
            </p>
            <Link
              href="/carteiras"
              className="text-sm font-medium text-primary hover:underline"
            >
              Ir para Carteiras →
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardContent className="space-y-1 p-5">
              <CardTitle>{c.title}</CardTitle>
              <div className={`text-2xl font-semibold ${c.cls}`}>
                {formatBRL(c.value)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Movimentações recentes</h2>
          <Link
            href="/movimentacoes"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Ver todas →
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                Nenhuma movimentação ainda. Lance manualmente em Movimentações ou
                importe um extrato.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((t) => {
                  const badge = TYPE_BADGE[t.type];
                  return (
                    <li
                      key={t.id}
                      className="flex items-center justify-between px-5 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm">
                          {t.description || badge.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(t.date)}
                          {t.accountName ? ` · ${t.accountName}` : ""}
                          {t.categoryName ? ` · ${t.categoryName}` : ""}
                        </div>
                      </div>
                      <div className={`text-sm font-medium ${badge.cls}`}>
                        {t.type === "EXPENSE" ? "−" : t.type === "INCOME" ? "+" : ""}
                        {formatBRL(Number(t.amount))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
