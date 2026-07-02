"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
      setMessage(
        "Link de acesso enviado! Confira seu e-mail e clique para entrar.",
      );
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">Finanças da Casa</h1>
            <p className="text-sm text-muted-foreground">
              Entre com seu e-mail para receber um link de acesso.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <Button
              type="submit"
              className="w-full"
              disabled={status === "sending" || status === "sent"}
            >
              {status === "sending" ? "Enviando..." : "Enviar link de acesso"}
            </Button>
          </form>

          {message && (
            <p
              className={
                status === "error"
                  ? "text-sm text-[var(--negative)]"
                  : "text-sm text-[var(--positive)]"
              }
            >
              {message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
