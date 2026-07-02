"use client";

import { useRef, useState, useTransition } from "react";
import { createTransaction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/field";

type Opt = { id: string; name: string };

const TYPES = [
  { value: "EXPENSE", label: "Despesa" },
  { value: "INCOME", label: "Receita" },
  { value: "TRANSFER", label: "Transferência" },
] as const;

export function TransactionForm({
  accounts,
  categories,
}: {
  accounts: Opt[];
  categories: Opt[];
}) {
  const [type, setType] = useState<"EXPENSE" | "INCOME" | "TRANSFER">("EXPENSE");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      ref={formRef}
      action={(fd) =>
        start(async () => {
          const r = await createTransaction(fd);
          setMsg(r.message);
          if (r.ok) {
            formRef.current?.reset();
            setType("EXPENSE");
          }
        })
      }
      className="grid grid-cols-2 gap-3 lg:grid-cols-6 lg:items-end"
    >
      <div>
        <Label htmlFor="type">Tipo</Label>
        <Select
          id="type"
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="date">Data</Label>
        <Input id="date" name="date" type="date" defaultValue={today} required />
      </div>

      <div>
        <Label htmlFor="amount">Valor (R$)</Label>
        <Input
          id="amount"
          name="amount"
          inputMode="decimal"
          placeholder="0,00"
          required
        />
      </div>

      <div>
        <Label htmlFor="accountId">
          {type === "TRANSFER" ? "De" : "Conta"}
        </Label>
        <Select id="accountId" name="accountId" required>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>

      {type === "TRANSFER" ? (
        <div>
          <Label htmlFor="counterAccountId">Para</Label>
          <Select id="counterAccountId" name="counterAccountId" required>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
      ) : (
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
      )}

      <div className="col-span-2 lg:col-span-6">
        <Label htmlFor="description">Descrição</Label>
        <div className="flex gap-3">
          <Input
            id="description"
            name="description"
            placeholder="Ex: Mercado Livre — fone de ouvido"
            className="flex-1"
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Lançar"}
          </Button>
        </div>
      </div>

      {msg && (
        <p className="col-span-2 text-sm text-muted-foreground lg:col-span-6">
          {msg}
        </p>
      )}
    </form>
  );
}
