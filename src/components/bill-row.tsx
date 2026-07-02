"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Trash2, Pencil, Check, X, Info } from "lucide-react";
import {
  cycleBillStatus,
  toggleBillReservado,
  deleteMonthlyBill,
  updateMonthlyBill,
} from "@/lib/actions";
import { formatBRL } from "@/lib/utils";
import { Input, Select } from "@/components/ui/field";
import { BillIcon } from "@/components/bill-icon";

const BTN_STYLE = {
  pending: "bg-[var(--warning)]/15 text-[var(--warning)]",
  paid: "bg-primary/15 text-primary",
};

type Opt = { id: string; name: string };

export type Bill = {
  id: string;
  name: string;
  amount: string;
  dueDay: number | null;
  status: "A_PAGAR" | "RESERVADO" | "PAGO";
  installmentNo: number | null;
  installmentTotal: number | null;
  categoryName: string | null;
  categoryId?: string | null;
  pct: number;
};

export function BillRow({
  bill,
  categories,
}: {
  bill: Bill;
  categories: Opt[];
}) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const isPago = bill.status === "PAGO";
  const isReservado = bill.status === "RESERVADO";

  // Fecha a janelinha ao clicar em qualquer lugar, rolar ou redimensionar.
  useEffect(() => {
    if (!tipPos) return;
    const close = () => setTipPos(null);
    document.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [tipPos]);

  // Resumo da parcela: valor da parcela × total, com pago/restante.
  const perInstallment = Number(bill.amount);
  const totalAll = bill.installmentTotal ? perInstallment * bill.installmentTotal : 0;
  const paidCount = bill.installmentNo
    ? bill.status === "PAGO"
      ? bill.installmentNo
      : bill.installmentNo - 1
    : 0;
  const paidValue = perInstallment * Math.max(0, paidCount);
  const remainingValue = Math.max(0, totalAll - paidValue);

  if (editing) {
    return (
      <form
        ref={formRef}
        action={(fd) =>
          start(async () => {
            const r = await updateMonthlyBill(fd);
            if (r.ok) setEditing(false);
          })
        }
        className="space-y-2 px-4 py-3 text-sm"
      >
        <input type="hidden" name="id" value={bill.id} />
        <div className="flex flex-wrap items-center gap-2">
          <Input
            name="name"
            defaultValue={bill.name}
            placeholder="Nome"
            className="min-w-40 flex-1"
            required
          />
          <Input
            name="dueDay"
            defaultValue={bill.dueDay ?? ""}
            inputMode="numeric"
            placeholder="Dia"
            className="w-16"
          />
          <Input
            name="amount"
            defaultValue={bill.amount}
            inputMode="decimal"
            placeholder="Valor"
            className="w-28"
            required
          />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Input
              name="installmentNo"
              defaultValue={bill.installmentNo ?? ""}
              inputMode="numeric"
              placeholder="3"
              className="w-12 text-center"
              title="Parcela atual"
            />
            <span>/</span>
            <Input
              name="installmentTotal"
              defaultValue={bill.installmentTotal ?? ""}
              inputMode="numeric"
              placeholder="10"
              className="w-12 text-center"
              title="Total de parcelas"
            />
          </div>
          <Select
            name="categoryId"
            defaultValue={bill.categoryId ?? ""}
            className="w-40"
          >
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <button
            type="submit"
            disabled={pending}
            title="Salvar"
            className="rounded-md bg-primary/15 p-2 text-primary hover:bg-primary/25"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            title="Cancelar"
            className="rounded-md p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name="applyAmountForward"
            className="accent-[var(--primary)]"
          />
          Valor também vale para os próximos meses (mudança permanente)
        </label>
      </form>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 text-sm ${pending ? "opacity-60" : ""}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <BillIcon name={bill.name} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{bill.name}</span>
            {bill.installmentTotal && (
              <span className="inline-flex shrink-0 items-center gap-1">
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-primary">
                  {bill.installmentNo ?? "?"}/{bill.installmentTotal}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (tipPos) {
                      setTipPos(null);
                      return;
                    }
                    const r = e.currentTarget.getBoundingClientRect();
                    const left = Math.max(
                      8,
                      Math.min(r.left, window.innerWidth - 248),
                    );
                    setTipPos({ x: left, y: r.bottom + 6 });
                  }}
                  title="Detalhes da parcela"
                  aria-label="Detalhes da parcela"
                  className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-primary"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {bill.categoryName ?? "Sem categoria"}
            {bill.dueDay ? ` · vence dia ${bill.dueDay}` : ""}
            {bill.installmentTotal && bill.installmentNo
              ? ` · faltam ${Math.max(0, bill.installmentTotal - bill.installmentNo)}`
              : ""}
          </div>
        </div>
      </div>

      <div className="hidden w-16 shrink-0 text-right text-xs text-muted-foreground sm:block tabular-nums">
        {(bill.pct * 100).toFixed(1)}%
      </div>

      <div className="w-28 shrink-0 text-right font-semibold tabular-nums">
        {formatBRL(Number(bill.amount))}
      </div>

      {/* Botão A pagar / Pago */}
      <button
        onClick={() => start(async () => void (await cycleBillStatus(bill.id)))}
        disabled={pending}
        title={isPago ? "Clique para desfazer pagamento" : "Clique para marcar como pago"}
        className={`w-20 shrink-0 rounded-full px-2.5 py-1 text-center text-xs font-medium cursor-pointer transition-colors ${
          isPago ? BTN_STYLE.paid : BTN_STYLE.pending
        }`}
      >
        {isPago ? "Pago" : "A pagar"}
      </button>

      {/* Caixinha de reservado */}
      <div className="flex w-10 shrink-0 justify-center">
        <button
          onClick={() => start(async () => void (await toggleBillReservado(bill.id)))}
          disabled={pending || isPago}
          title={isPago ? "Já pago" : isReservado ? "Remover reserva" : "Marcar como reservado"}
          className={`flex h-5 w-5 items-center justify-center rounded border text-[11px] font-bold transition-colors ${
            isReservado
              ? "border-sky-700 bg-sky-800 text-sky-200"
              : "border-border bg-transparent text-transparent hover:border-muted-foreground"
          } ${isPago ? "opacity-25 cursor-not-allowed" : "cursor-pointer"}`}
        >
          R
        </button>
      </div>

      <div className="flex w-14 shrink-0 items-center justify-end gap-2">
        <button
          onClick={() => setEditing(true)}
          title="Editar"
          className="text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={() =>
            start(async () => void (await deleteMonthlyBill(bill.id)))
          }
          disabled={pending}
          title="Remover"
          className="text-muted-foreground hover:text-[var(--negative)]"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Janelinha flutuante (portal) — só ao tocar no (i), na frente de tudo. */}
      {tipPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed z-[9999] w-60 rounded-lg border border-border bg-[#232323] p-3 text-xs shadow-2xl"
            style={{ left: tipPos.x, top: tipPos.y }}
          >
            <div className="mb-2 font-medium text-foreground">
                Parcela {bill.installmentNo ?? "?"} de {bill.installmentTotal}
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">Valor da parcela</span>
                <span className="tabular-nums">{formatBRL(perInstallment)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">
                  Pago ({Math.max(0, paidCount)}x)
                </span>
                <span className="tabular-nums text-[var(--positive)]">
                  {formatBRL(paidValue)}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">Restante</span>
                <span className="tabular-nums text-[var(--warning)]">
                  {formatBRL(remainingValue)}
                </span>
              </div>
            <div className="mt-1 flex justify-between border-t border-border pt-1.5">
              <span className="text-muted-foreground">Total</span>
              <span className="tabular-nums font-medium">
                {formatBRL(totalAll)}
              </span>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
