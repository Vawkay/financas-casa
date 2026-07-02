"use client";

import { useRef, useState, useTransition } from "react";
import {
  Landmark,
  CreditCard,
  HandCoins,
  PiggyBank,
  Pencil,
  Check,
  X,
  KeyRound,
} from "lucide-react";
import { updateAccount } from "@/lib/actions";
import { Input, Select } from "@/components/ui/field";
import { formatBRL } from "@/lib/utils";

const TYPE_META: Record<
  string,
  { label: string; icon: typeof Landmark; tone: string }
> = {
  CHECKING: { label: "Conta", icon: Landmark, tone: "text-[var(--positive)]" },
  SAVINGS: { label: "Reserva", icon: PiggyBank, tone: "text-[var(--positive)]" },
  CREDIT_CARD: { label: "Cartão", icon: CreditCard, tone: "text-[var(--negative)]" },
  LOAN: { label: "Empréstimo", icon: HandCoins, tone: "text-[var(--warning)]" },
};

export type AccountCardData = {
  id: string;
  name: string;
  type: "CHECKING" | "CREDIT_CARD" | "LOAN" | "SAVINGS";
  institution: string | null;
  currentBalance: string;
  creditLimit: string | null;
  dueDay: number | null;
  hasPassword: boolean;
};

export function AccountCard({ a }: { a: AccountCardData }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const meta = TYPE_META[a.type];
  const Icon = meta.icon;
  const isCard = a.type === "CREDIT_CARD" || a.type === "LOAN";

  if (editing) {
    return (
      <form
        ref={formRef}
        action={(fd) =>
          start(async () => {
            const r = await updateAccount(fd);
            setMsg(r.message);
            if (r.ok) setEditing(false);
          })
        }
        className="space-y-2 rounded-md border border-primary/40 bg-card px-4 py-3 text-sm"
      >
        <input type="hidden" name="id" value={a.id} />
        <div className="flex flex-wrap items-center gap-2">
          <Input
            name="name"
            defaultValue={a.name}
            placeholder="Nome"
            className="min-w-36 flex-1"
            required
          />
          <Select name="type" defaultValue={a.type} className="w-36">
            <option value="CHECKING">Conta</option>
            <option value="CREDIT_CARD">Cartão de crédito</option>
            <option value="LOAN">Empréstimo / Linha</option>
            <option value="SAVINGS">Cofrinho / Reserva</option>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            name="institution"
            defaultValue={a.institution ?? ""}
            placeholder="Instituição"
            className="w-36"
          />
          <Input
            name="currentBalance"
            defaultValue={a.currentBalance}
            inputMode="decimal"
            placeholder="Saldo"
            className="w-28"
            title="Saldo atual"
          />
          <Input
            name="dueDay"
            defaultValue={a.dueDay ?? ""}
            inputMode="numeric"
            placeholder="Venc."
            className="w-16"
            title="Dia de vencimento"
          />
          {isCard && (
            <Input
              name="creditLimit"
              defaultValue={a.creditLimit ?? ""}
              inputMode="decimal"
              placeholder="Limite"
              className="w-24"
              title="Limite de crédito"
            />
          )}
        </div>
        {isCard && (
          <div className="flex items-center gap-2">
            <KeyRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Input
              name="statementPassword"
              type="text"
              placeholder={
                a.hasPassword
                  ? "Senha salva — deixe vazio p/ manter"
                  : "Senha do PDF da fatura"
              }
              className="flex-1"
              autoComplete="off"
              title="Senha do PDF da fatura (vazio mantém a atual; digite - para limpar)"
            />
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{msg}</span>
          <div className="flex gap-2">
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
              onClick={() => {
                setEditing(false);
                setMsg("");
              }}
              title="Cancelar"
              className="rounded-md p-2 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="group flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#171717] text-muted-foreground group-hover:text-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium leading-tight">
            {a.name}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              {meta.label}
              {a.institution ? ` · ${a.institution}` : ""}
              {a.dueDay ? ` · vence dia ${a.dueDay}` : ""}
            </span>
            {isCard && a.hasPassword && (
              <KeyRound
                className="h-3 w-3 text-primary"
                aria-label="Senha de fatura salva"
              />
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-semibold tabular-nums ${meta.tone}`}>
          {formatBRL(Number(a.currentBalance))}
        </span>
        <button
          onClick={() => setEditing(true)}
          title="Editar conta"
          className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
