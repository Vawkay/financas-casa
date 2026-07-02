"use client";

import { useRef, useState, useTransition } from "react";
import { addMonthlyBill } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/field";

type Opt = { id: string; name: string };

export function BillForm({
  month,
  categories,
}: {
  month: string;
  categories: Opt[];
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(fd) =>
        start(async () => {
          const r = await addMonthlyBill(fd);
          setMsg(r.message);
          if (r.ok) formRef.current?.reset();
        })
      }
      className="space-y-3"
    >
      <input type="hidden" name="month" value={month} />

      <div>
        <Label htmlFor="name">Conta</Label>
        <Input id="name" name="name" placeholder="Ex: Academia" required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="amount">Valor (R$)</Label>
          <Input id="amount" name="amount" inputMode="decimal" placeholder="0,00" required />
        </div>
        <div>
          <Label htmlFor="dueDay">Vence dia</Label>
          <Input id="dueDay" name="dueDay" inputMode="numeric" placeholder="10" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="categoryId">Categoria</Label>
          <Select id="categoryId" name="categoryId">
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="status">Situação</Label>
          <Select id="status" name="status" defaultValue="A_PAGAR">
            <option value="A_PAGAR">A pagar</option>
            <option value="RESERVADO">Reservado</option>
            <option value="PAGO">Pago</option>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>Parcela</span>
        <Input
          name="installmentNo"
          inputMode="numeric"
          placeholder="3"
          className="h-7 w-12 text-center"
        />
        <span>de</span>
        <Input
          name="installmentTotal"
          inputMode="numeric"
          placeholder="10"
          className="h-7 w-12 text-center"
        />
        <span className="text-[11px]">(opcional)</span>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" name="recurring" className="accent-[var(--primary)]" />
        Tornar recorrente (repete todo mês)
      </label>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "..." : "Adicionar conta"}
      </Button>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </form>
  );
}
