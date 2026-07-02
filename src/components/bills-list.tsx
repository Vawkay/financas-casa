"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown } from "lucide-react";
import { BillRow, type Bill } from "@/components/bill-row";

type Opt = { id: string; name: string };
type Filter = "all" | "A_PAGAR" | "RESERVADO" | "PAGO";
type Sort = "default" | "amount_desc" | "amount_asc" | "status";

const STATUS_ORDER: Record<string, number> = { A_PAGAR: 0, RESERVADO: 1, PAGO: 2 };

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "A_PAGAR", label: "A pagar" },
  { key: "RESERVADO", label: "Reservado" },
  { key: "PAGO", label: "Pago" },
];

const SORTS: { key: Sort; label: string }[] = [
  { key: "default", label: "Padrão" },
  { key: "amount_desc", label: "Maior valor" },
  { key: "amount_asc", label: "Menor valor" },
  { key: "status", label: "Status" },
];

export function BillsList({
  bills,
  categories,
}: {
  bills: Bill[];
  categories: Opt[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("default");

  const counts = useMemo(
    () => ({
      all: bills.length,
      A_PAGAR: bills.filter((b) => b.status === "A_PAGAR").length,
      RESERVADO: bills.filter((b) => b.status === "RESERVADO").length,
      PAGO: bills.filter((b) => b.status === "PAGO").length,
    }),
    [bills],
  );

  const displayed = useMemo(() => {
    const base = filter === "all" ? bills : bills.filter((b) => b.status === filter);
    if (sort === "default") return base;
    return [...base].sort((a, b) => {
      if (sort === "amount_desc") return Number(b.amount) - Number(a.amount);
      if (sort === "amount_asc") return Number(a.amount) - Number(b.amount);
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    });
  }, [bills, filter, sort]);

  return (
    <>
      {/* Barra de filtro + ordenação */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                filter === f.key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {f.label}
              {counts[f.key] > 0 && (
                <span className="tabular-nums opacity-60">{counts[f.key]}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowUpDown className="h-3 w-3" />
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`rounded px-2 py-0.5 transition-colors ${
                sort === s.key
                  ? "bg-muted text-foreground font-medium"
                  : "hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cabeçalho das colunas */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <span className="flex-1">Conta</span>
        <span className="hidden w-16 text-right sm:block">Peso</span>
        <span className="w-28 text-right">Valor</span>
        <span className="w-20 text-center">Situação</span>
        <span className="w-10 text-center">Reserv.</span>
        <span className="w-14" />
      </div>

      {displayed.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma conta com esse filtro.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {displayed.map((b) => (
            <BillRow key={b.id} bill={b} categories={categories} />
          ))}
        </div>
      )}
    </>
  );
}
