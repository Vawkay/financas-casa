import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { SeedButton } from "@/components/seed-button";
import { AccountForm } from "@/components/account-form";
import { AccountCard } from "@/components/account-card";
import { getAccounts } from "@/lib/data";
import { formatBRL } from "@/lib/utils";

const GROUPS: { title: string; types: string[] }[] = [
  { title: "Contas e reservas", types: ["CHECKING", "SAVINGS"] },
  { title: "Cartões de crédito", types: ["CREDIT_CARD"] },
  { title: "Empréstimos e linhas", types: ["LOAN"] },
];

export default async function CarteirasPage() {
  const accounts = await getAccounts();

  if (accounts.length === 0) {
    return (
      <div>
        <PageHeader
          title="Carteiras"
          subtitle="Suas contas, cartões e linhas de crédito."
        />
        <Card>
          <CardContent className="space-y-4 p-8 text-center">
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Você ainda não tem contas cadastradas. Crie de uma vez as suas
              contas reais (Mercado Pago, Wise, PicPay Empresas, cartões e linha
              de crédito) e as categorias da planilha.
            </p>
            <div className="flex justify-center">
              <SeedButton />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sum = (types: string[]) =>
    accounts
      .filter((a) => types.includes(a.type))
      .reduce((acc, a) => acc + Number(a.currentBalance), 0);

  const stats = [
    { label: "Saldo em contas", value: sum(["CHECKING", "SAVINGS"]), tone: "text-[var(--positive)]" },
    { label: "Faturas de cartão", value: sum(["CREDIT_CARD"]), tone: "text-[var(--negative)]" },
    { label: "Empréstimos", value: sum(["LOAN"]), tone: "text-[var(--warning)]" },
  ];

  return (
    <div>
      <PageHeader
        title="Carteiras"
        subtitle="Suas contas, cartões e linhas de crédito."
      />

      {/* Resumo */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className={`mt-1 text-lg font-semibold tabular-nums ${s.tone}`}>
                {formatBRL(s.value)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Grupos */}
      <div className="space-y-6">
        {GROUPS.map((g) => {
          const items = accounts.filter((a) => g.types.includes(a.type));
          if (items.length === 0) return null;
          return (
            <section key={g.title}>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {g.title}
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((a) => (
                  <AccountCard
                    key={a.id}
                    a={{
                      id: a.id,
                      name: a.name,
                      type: a.type,
                      institution: a.institution,
                      currentBalance: a.currentBalance,
                      creditLimit: a.creditLimit,
                      dueDay: a.dueDay,
                      hasPassword: Boolean(a.statementPassword),
                    }}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Adicionar */}
      <Card className="mt-6">
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-medium">Adicionar conta</h2>
          <AccountForm />
        </CardContent>
      </Card>
    </div>
  );
}
