"use client";

import { useRef, useState, useTransition } from "react";
import { createDebt } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/field";

export function DebtForm() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(fd) =>
        start(async () => {
          const r = await createDebt(fd);
          setMsg(r.message);
          if (r.ok) formRef.current?.reset();
        })
      }
      className="grid grid-cols-2 gap-3 lg:grid-cols-6 lg:items-end"
    >
      <div className="col-span-2">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" placeholder="Ex: Empréstimo Nubank" required />
      </div>
      <div>
        <Label htmlFor="direction">Tipo</Label>
        <Select id="direction" name="direction" defaultValue="TAKEN">
          <option value="TAKEN">Eu devo</option>
          <option value="GIVEN">Me devem</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="principalTotal">Total (R$)</Label>
        <Input id="principalTotal" name="principalTotal" inputMode="decimal" placeholder="0,00" required />
      </div>
      <div>
        <Label htmlFor="amountPaid">Já pago (R$)</Label>
        <Input id="amountPaid" name="amountPaid" inputMode="decimal" placeholder="0,00" />
      </div>
      <div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "..." : "Adicionar"}
        </Button>
      </div>

      <div className="col-span-2 lg:col-span-3">
        <Label htmlFor="counterpartyName">Credor / devedor (opcional)</Label>
        <Input id="counterpartyName" name="counterpartyName" placeholder="Ex: Nubank, MRV, João" />
      </div>
      <div>
        <Label htmlFor="installments">Parcelas (opcional)</Label>
        <Input id="installments" name="installments" inputMode="numeric" placeholder="Ex: 80" />
      </div>

      {msg && (
        <p className="col-span-2 text-sm text-muted-foreground lg:col-span-6">
          {msg}
        </p>
      )}
    </form>
  );
}
