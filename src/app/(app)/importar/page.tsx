import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ImportClient } from "@/components/import-client";
import { CoverageGrid } from "@/components/coverage-grid";
import { getAccounts, getCategories, getCoverage } from "@/lib/data";

export default async function ImportarPage() {
  const [accounts, categories, coverage] = await Promise.all([
    getAccounts(),
    getCategories(),
    getCoverage(6),
  ]);
  const hasAI = Boolean(process.env.GEMINI_API_KEY);

  if (accounts.length === 0) {
    return (
      <div>
        <PageHeader
          title="Importar extrato"
          subtitle="Suba o extrato do Mercado Pago (CSV/PDF) e revise a categorização."
        />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Cadastre suas contas primeiro em{" "}
            <a href="/carteiras" className="text-primary hover:underline">
              Carteiras
            </a>
            .
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Importar extrato"
        subtitle="Suba o extrato do Mercado Pago (CSV/PDF), revise e importe — sem contar fatura/empréstimo como gasto."
      />

      <Card className="mb-5">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Completude dos extratos</h2>
            <span className="text-xs text-muted-foreground">
              últimos 6 meses · verde = importado
            </span>
          </div>
          <CoverageGrid
            months={coverage.months}
            accounts={coverage.accounts}
            coverage={coverage.coverage}
          />
        </CardContent>
      </Card>

      <ImportClient
        accounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          hasPassword: Boolean(a.statementPassword),
        }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        hasAI={hasAI}
      />
    </div>
  );
}
