import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { DebtCard, type DebtView } from "@/components/debt-card";
import { DebtForm } from "@/components/debt-form";
import { getDebts } from "@/lib/data";
import { formatBRL } from "@/lib/utils";

export default async function DividasPage() {
  const debts = (await getDebts()) as DebtView[];

  const owe = debts.filter((d) => d.direction === "TAKEN");
  const owed = debts.filter((d) => d.direction === "GIVEN");

  const sumField = (list: DebtView[], f: (d: DebtView) => number) =>
    list.reduce((s, d) => s + f(d), 0);

  const totalOwe = sumField(owe, (d) => Number(d.principalTotal));
  const paidOwe = sumField(owe, (d) => Number(d.amountPaid));
  const faltaOwe = Math.max(0, totalOwe - paidOwe);

  const summary = [
    { title: "Total que eu devo", value: totalOwe, cls: "" },
    { title: "Já paguei", value: paidOwe, cls: "text-[var(--positive)]" },
    { title: "Falta pagar", value: faltaOwe, cls: "text-[var(--warning)]" },
  ];

  return (
    <div>
      <PageHeader
        title="Dívidas"
        subtitle="Pago / Total / Falta e progresso de quitação — como no bloco da planilha."
      />

      <div className="mb-6 grid grid-cols-3 gap-4">
        {summary.map((s) => (
          <Card key={s.title}>
            <CardContent className="space-y-1 p-4">
              <CardTitle>{s.title}</CardTitle>
              <div className={`text-lg font-semibold tabular-nums ${s.cls}`}>
                {formatBRL(s.value)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {debts.length > 0 ? (
        <div className="space-y-6">
          {owe.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Eu devo
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {owe.map((d) => (
                  <DebtCard key={d.id} debt={d} />
                ))}
              </div>
            </section>
          )}
          {owed.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Me devem
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {owed.map((d) => (
                  <DebtCard key={d.id} debt={d} />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nenhuma dívida cadastrada. Adicione abaixo as suas (empréstimos,
            acordos, renegociações) conferindo Total e o quanto já pagou.
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-medium">Adicionar dívida</h2>
          <DebtForm />
        </CardContent>
      </Card>
    </div>
  );
}
