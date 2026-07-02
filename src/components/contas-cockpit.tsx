"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp, ArrowRight } from "lucide-react";
import { IncomeComposition, type Source } from "@/components/income-composition";
import { formatBRL } from "@/lib/utils";

type Totals = { total: number; aPagar: number; reservado: number; pago: number };

/** Anel de progresso (donut) com o % no centro. */
function Ring({ pct }: { pct: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(1, Math.max(0, pct)));
  return (
    <svg width="60" height="60" viewBox="0 0 48 48" className="shrink-0">
      <circle cx="24" cy="24" r={r} fill="none" stroke="var(--muted)" strokeWidth="5" />
      <circle
        cx="24"
        cy="24"
        r={r}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        transform="rotate(-90 24 24)"
      />
      <text
        x="24"
        y="25"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-[var(--foreground)] text-[11px] font-semibold"
      >
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}

function SummaryRow({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${tone}`}>{formatBRL(value)}</span>
    </div>
  );
}

export function ContasCockpit({
  month,
  sources,
  totals,
  forecast,
  nextMonthLabel,
  nextMonthHref,
  addBillSlot,
  children,
}: {
  month: string;
  sources: Source[];
  totals: Totals;
  forecast: { total: number; count: number };
  nextMonthLabel: string;
  nextMonthHref: string;
  addBillSlot: React.ReactNode;
  children: React.ReactNode;
}) {
  // Overrides locais por fonte (id -> valor); o resto vem do servidor.
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const income = sources.reduce(
    (s, src) => s + (amounts[src.id] ?? src.amount),
    0,
  );
  const saldo = income - totals.total;
  const pctPaid = totals.total > 0 ? totals.pago / totals.total : 0;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      {/* ESQUERDA: as contas (itens) + adicionar conta */}
      <div className="space-y-4 lg:col-span-2">
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-medium">
            Contas do mês
          </div>
          {children}
        </div>
        {addBillSlot}
      </div>

      {/* DIREITA: saldo, resumo, receitas, previsão */}
      <div className="space-y-4 lg:col-span-1">
        {/* Saldo possível */}
        <div className="rounded-xl border border-border bg-gradient-to-br from-card to-[#1a1a1a] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Saldo possível
              </div>
              <div
                className={`mt-1 text-3xl font-bold tabular-nums ${
                  saldo >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"
                }`}
              >
                {formatBRL(saldo)}
              </div>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Ring pct={pctPaid} />
              <span className="text-[10px] text-muted-foreground">pago</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {formatBRL(income)} receitas − {formatBRL(totals.total)} contas
          </div>
        </div>

        {/* Resumo das contas */}
        <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
          <SummaryRow label="Total do mês" value={totals.total} />
          <SummaryRow label="A pagar" value={totals.aPagar} tone="text-[var(--warning)]" />
          <SummaryRow label="Reservado" value={totals.reservado} tone="text-sky-400" />
          <SummaryRow label="Pago" value={totals.pago} tone="text-[var(--positive)]" />
        </div>

        {/* Receitas */}
        <IncomeComposition
          month={month}
          sources={sources}
          income={income}
          onAmountChange={(id, v) => setAmounts((p) => ({ ...p, [id]: v }))}
        />

        {/* Previsão do próximo mês */}
        <Link
          href={nextMonthHref}
          className="group block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
        >
          <div className="mb-1 flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4 text-primary" />
            Previsão de {nextMonthLabel}
          </div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatBRL(forecast.total)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            {forecast.count > 0
              ? `${forecast.count} conta${forecast.count > 1 ? "s" : ""} fixa${
                  forecast.count > 1 ? "s" : ""
                }`
              : "cadastre contas fixas"}
            <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </Link>
      </div>
    </div>
  );
}
