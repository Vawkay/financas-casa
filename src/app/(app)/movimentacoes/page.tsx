import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TransactionForm } from "@/components/transaction-form";
import { TransactionRow } from "@/components/transaction-row";
import { getAccounts, getCategories, getRecentTransactions } from "@/lib/data";

export default async function MovimentacoesPage() {
  const [accounts, categories, transactions] = await Promise.all([
    getAccounts(),
    getCategories(),
    getRecentTransactions(100),
  ]);

  return (
    <div>
      <PageHeader
        title="Movimentações"
        subtitle="Extrato unificado — lançamentos manuais e importados."
      />

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Cadastre suas contas primeiro em{" "}
            <a href="/carteiras" className="text-primary hover:underline">
              Carteiras
            </a>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-5">
              <h2 className="mb-3 text-sm font-medium">Novo lançamento</h2>
              <TransactionForm accounts={accounts} categories={categories} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  Nenhuma movimentação ainda.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {transactions.map((t) => (
                    <TransactionRow key={t.id} t={t} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
