"use client";

import { useRef, useState, useTransition } from "react";
import { createAccount } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/field";

export function AccountForm() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(fd) =>
        start(async () => {
          const r = await createAccount(fd);
          setMsg(r.message);
          if (r.ok) formRef.current?.reset();
        })
      }
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
    >
      <div className="lg:col-span-2">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" placeholder="Ex: Nubank" required />
      </div>
      <div>
        <Label htmlFor="type">Tipo</Label>
        <Select id="type" name="type" defaultValue="CHECKING">
          <option value="CHECKING">Conta</option>
          <option value="CREDIT_CARD">Cartão de crédito</option>
          <option value="LOAN">Empréstimo / Linha</option>
          <option value="SAVINGS">Cofrinho / Reserva</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="currentBalance">Saldo (R$)</Label>
        <Input
          id="currentBalance"
          name="currentBalance"
          inputMode="decimal"
          placeholder="0,00"
        />
      </div>
      <div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Salvando..." : "Adicionar"}
        </Button>
      </div>
      {msg && (
        <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-5">
          {msg}
        </p>
      )}
    </form>
  );
}
