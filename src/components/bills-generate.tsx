"use client";

import { useState, useTransition } from "react";
import { seedRecurringBills, generateMonthFromRecurring } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function BillsGenerate({
  month,
  recurringCount,
}: {
  month: string;
  recurringCount: number;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  return (
    <div className="flex flex-col items-start gap-2">
      {recurringCount === 0 ? (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => setMsg((await seedRecurringBills()).message))
          }
        >
          {pending ? "Criando..." : "Criar contas fixas da planilha"}
        </Button>
      ) : (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () =>
              setMsg((await generateMonthFromRecurring(month)).message),
            )
          }
        >
          {pending ? "Gerando..." : "Gerar contas recorrentes deste mês"}
        </Button>
      )}
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}
