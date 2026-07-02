import { Check } from "lucide-react";
import type { Account } from "@/db/schema";

const MONTH_SHORT = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(new Date(y, mm - 1, 1))
    .replace(".", "");
};

const TYPE_ORDER: Record<string, number> = {
  CHECKING: 0,
  SAVINGS: 1,
  CREDIT_CARD: 2,
  LOAN: 3,
};

/**
 * Grade contas × meses: célula preenchida = mês com extrato importado.
 * Ajuda a ver rapidamente qual fatura/mês ainda falta importar.
 */
export function CoverageGrid({
  months,
  accounts,
  coverage,
}: {
  months: string[];
  accounts: Account[];
  coverage: Map<string, Map<string, number>>;
}) {
  // Mostra contas onde faz sentido acompanhar importação (não cofrinhos vazios).
  const rows = [...accounts].sort(
    (a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9),
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left text-xs font-medium text-muted-foreground">
              Conta
            </th>
            {months.map((m) => (
              <th
                key={m}
                className="px-1 py-1 text-center text-xs font-medium capitalize text-muted-foreground"
              >
                {MONTH_SHORT(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((acc) => {
            const cov = coverage.get(acc.id);
            return (
              <tr key={acc.id}>
                <td className="whitespace-nowrap px-2 py-1 text-sm">
                  {acc.name}
                </td>
                {months.map((m) => {
                  const n = cov?.get(m) ?? 0;
                  const filled = n > 0;
                  return (
                    <td key={m} className="p-0.5 text-center">
                      <div
                        title={
                          filled
                            ? `${n} lançamentos importados`
                            : "Sem extrato importado"
                        }
                        className={`mx-auto flex h-7 w-7 items-center justify-center rounded-md text-[10px] ${
                          filled
                            ? "bg-primary/20 text-primary"
                            : "bg-[#171717] text-muted-foreground/40"
                        }`}
                      >
                        {filled ? <Check className="h-3.5 w-3.5" /> : "—"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
