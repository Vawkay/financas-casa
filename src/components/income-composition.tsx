"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Plus, Pencil, Trash2, Check, X, Calculator } from "lucide-react";
import {
  setIncomeAmount,
  addIncomeSource,
  renameIncomeSource,
  deleteIncomeSource,
} from "@/lib/actions";
import { Input } from "@/components/ui/field";
import { formatBRL } from "@/lib/utils";

export type Source = {
  id: string;
  name: string;
  via: string | null;
  kind: string;
  hourlyRate: number | null;
  amount: number;
};

const parse = (s: string) =>
  Number(s.replace(/\./g, "").replace(",", ".")) || 0;
const fmtInput = (n: number) => (n ? String(n).replace(".", ",") : "");

const DEFAULT_HOURLY_RATE = 60.46;

function HourCalcPopover({
  source,
  month,
  onApply,
  onClose,
  anchorRect,
}: {
  source: Source;
  month: string;
  onApply: (value: number) => void;
  onClose: () => void;
  anchorRect: DOMRect;
}) {
  const [rate, setRate] = useState(
    fmtInput(source.hourlyRate ?? DEFAULT_HOURLY_RATE),
  );
  const [hours, setHours] = useState("");
  const [pending, start] = useTransition();

  const total = parse(rate) * parse(hours);

  function apply() {
    if (!total) return;
    start(async () => {
      await setIncomeAmount(month, source.id, total);
      onApply(total);
      onClose();
    });
  }

  const x = Math.max(8, Math.min(anchorRect.left, window.innerWidth - 288));
  const y = anchorRect.bottom + 6;

  return createPortal(
    <div
      onClick={(e) => e.stopPropagation()}
      className="fixed z-[9999] w-72 rounded-xl border border-border bg-[#232323] p-4 shadow-2xl"
      style={{ left: x, top: y }}
    >
      <div className="mb-3 text-sm font-medium">
        Calcular receita — {source.name}
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <label className="w-28 shrink-0 text-xs text-muted-foreground">
            Valor/hora (R$)
          </label>
          <Input
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            inputMode="decimal"
            className="h-8 flex-1 text-right tabular-nums"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="w-28 shrink-0 text-xs text-muted-foreground">
            Horas trabalhadas
          </label>
          <Input
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            inputMode="decimal"
            placeholder="160"
            className="h-8 flex-1 text-right tabular-nums"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && apply()}
          />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-xs text-muted-foreground">Total</span>
          <span
            className={`text-base font-bold tabular-nums ${total ? "text-[var(--positive)]" : "text-muted-foreground"}`}
          >
            {formatBRL(total)}
          </span>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          Cancelar
        </button>
        <button
          onClick={apply}
          disabled={!total || pending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40 hover:bg-primary/90"
        >
          Aplicar
        </button>
      </div>
    </div>,
    document.body,
  );
}

function SourceRow({
  month,
  source,
  onAmount,
}: {
  month: string;
  source: Source;
  onAmount: (id: string, value: number) => void;
}) {
  const [raw, setRaw] = useState(fmtInput(source.amount));
  const [saved, setSaved] = useState(source.amount);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(source.name);
  const [via, setVia] = useState(source.via ?? "");
  const [variable, setVariable] = useState(source.kind === "PJ_HOURLY");
  const [calcAnchor, setCalcAnchor] = useState<DOMRect | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!calcAnchor) return;
    const close = () => setCalcAnchor(null);
    document.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [calcAnchor]);

  function saveAmount() {
    const v = parse(raw);
    onAmount(source.id, v);
    if (v === saved) return;
    start(async () => {
      const r = await setIncomeAmount(month, source.id, v);
      if (r.ok) setSaved(v);
    });
  }

  if (editing) {
    return (
      <div className="space-y-1.5 py-1.5">
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome"
            className="h-8 flex-1"
          />
          <Input
            value={via}
            onChange={(e) => setVia(e.target.value)}
            placeholder="Via (ex: Wise)"
            className="h-8 w-32"
          />
          <button
            onClick={() =>
              start(async () => {
                const r = await renameIncomeSource(source.id, name, via, variable);
                if (r.ok) setEditing(false);
              })
            }
            disabled={pending}
            title="Salvar"
            className="rounded-md bg-primary/15 p-1.5 text-primary hover:bg-primary/25"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => setEditing(false)}
            title="Cancelar"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={variable}
            onChange={(e) => setVariable(e.target.checked)}
            className="accent-[var(--primary)]"
          />
          Renda variável (valor muda mês a mês)
        </label>
      </div>
    );
  }

  return (
    <>
      <div
        className={`group flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/30 ${
          pending ? "opacity-60" : ""
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm">{source.name}</span>
            {source.kind === "PJ_HOURLY" && (
              <span className="shrink-0 rounded bg-[var(--warning)]/15 px-1.5 py-0.5 text-[10px] text-[var(--warning)]">
                variável
              </span>
            )}
            <button
              onClick={() => setEditing(true)}
              title="Editar fonte"
              className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() =>
                start(async () => void (await deleteIncomeSource(source.id)))
              }
              title="Remover fonte"
              className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-[var(--negative)] group-hover:opacity-100"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          {source.via && (
            <div className="text-xs text-muted-foreground">{source.via}</div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {source.kind === "PJ_HOURLY" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCalcAnchor(calcAnchor ? null : e.currentTarget.getBoundingClientRect());
              }}
              title="Calcular por horas"
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                calcAnchor
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Calculator className="h-3.5 w-3.5" />
            </button>
          )}
          <Input
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={saveAmount}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            inputMode="decimal"
            placeholder="0,00"
            className="h-8 w-28 text-right tabular-nums"
          />
        </div>
      </div>

      {calcAnchor && typeof document !== "undefined" && (
        <HourCalcPopover
          source={source}
          month={month}
          anchorRect={calcAnchor}
          onApply={(v) => {
            setRaw(fmtInput(v));
            setSaved(v);
            onAmount(source.id, v);
          }}
          onClose={() => setCalcAnchor(null)}
        />
      )}
    </>
  );
}

export function IncomeComposition({
  month,
  sources,
  income,
  onAmountChange,
}: {
  month: string;
  sources: Source[];
  income: number;
  onAmountChange: (id: string, value: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium">Receitas do mês</div>
        <span className="text-sm font-semibold tabular-nums text-[var(--positive)]">
          {formatBRL(income)}
        </span>
      </div>

      <div className="space-y-0.5">
        {sources.map((s) => (
          <SourceRow key={s.id} month={month} source={s} onAmount={onAmountChange} />
        ))}
      </div>

      {adding ? (
        <div className="mt-2 flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome da nova fonte"
            className="h-8 flex-1"
            autoFocus
          />
          <button
            onClick={() =>
              start(async () => {
                const r = await addIncomeSource(newName);
                if (r.ok) {
                  setNewName("");
                  setAdding(false);
                }
              })
            }
            disabled={pending}
            className="rounded-md bg-primary/15 p-1.5 text-primary hover:bg-primary/25"
            title="Adicionar"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => setAdding(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            title="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> adicionar fonte
        </button>
      )}
    </div>
  );
}
