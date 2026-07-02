"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { registerDebtPayment, deleteDebt } from "@/lib/actions";
import { formatBRL } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export type DebtView = {
  id: string;
  name: string;
  direction: "TAKEN" | "GIVEN";
  principalTotal: string;
  amountPaid: string;
  installments: number | null;
  counterpartyName: string | null;
  active: boolean;
};

export function DebtCard({ debt }: { debt: DebtView }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const total = Number(debt.principalTotal);
  const paid = Number(debt.amountPaid);
  const falta = Math.max(0, total - paid);
  const pct = total > 0 ? Math.min(1, paid / total) : 0;
  const quitada = !debt.active || falta <= 0;

  return (
    <Card className={quitada ? "opacity-70" : ""}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-medium">{debt.name}</div>
            <div className="text-xs text-muted-foreground">
              {debt.counterpartyName ? `${debt.counterpartyName} · ` : ""}
              {debt.direction === "TAKEN" ? "eu devo" : "me devem"}
              {debt.installments ? ` · ${debt.installments}x` : ""}
            </div>
          </div>
          <button
            onClick={() => start(async () => void (await deleteDebt(debt.id)))}
            disabled={pending}
            title="Remover"
            className="text-muted-foreground hover:text-[var(--negative)]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Barra de progresso */}
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#171717]">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct * 100}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs tabular-nums">
            <span className="text-[var(--positive)]">
              Pago {formatBRL(paid)}
            </span>
            <span className="text-muted-foreground">
              Total {formatBRL(total)}
            </span>
            <span className={quitada ? "text-[var(--positive)]" : "text-[var(--warning)]"}>
              {quitada ? "Quitada ✓" : `Falta ${formatBRL(falta)}`}
            </span>
          </div>
        </div>

        {!quitada && (
          <form
            ref={formRef}
            action={(fd) =>
              start(async () => {
                fd.set("id", debt.id);
                const r = await registerDebtPayment(fd);
                setMsg(r.message);
                if (r.ok) formRef.current?.reset();
              })
            }
            className="flex items-center gap-2"
          >
            <Input
              name="amount"
              inputMode="decimal"
              placeholder="Registrar pagamento (R$)"
              className="flex-1"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={pending}>
              {pending ? "..." : "Pagar"}
            </Button>
          </form>
        )}
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      </CardContent>
    </Card>
  );
}
