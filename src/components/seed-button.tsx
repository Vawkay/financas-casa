"use client";

import { useState, useTransition } from "react";
import { seedDefaults } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function SeedButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  return (
    <div className="space-y-2">
      <Button
        onClick={() =>
          start(async () => {
            const r = await seedDefaults();
            setMsg(r.message);
          })
        }
        disabled={pending}
      >
        {pending ? "Criando..." : "Criar contas e categorias iniciais"}
      </Button>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}
