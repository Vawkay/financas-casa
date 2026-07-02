"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X, Search, Trash2 } from "lucide-react";
import { renameMerchant } from "@/lib/import/actions";
import { deleteTransaction } from "@/lib/actions";
import { Input } from "@/components/ui/field";
import { formatBRL, formatDate } from "@/lib/utils";

const TYPE_BADGE: Record<string, { label: string; cls: string; sign: string }> = {
  INCOME: { label: "Receita", cls: "text-[var(--positive)]", sign: "+" },
  EXPENSE: { label: "Despesa", cls: "text-[var(--negative)]", sign: "−" },
  TRANSFER: { label: "Transferência", cls: "text-muted-foreground", sign: "" },
};

export type Tx = {
  id: string;
  date: string;
  amount: string;
  type: string;
  description: string;
  rawDescription: string | null;
  accountName: string | null;
  categoryName: string | null;
};

/** Só o estabelecimento p/ buscar: sem portador (· Nome) e sem parcela. */
function searchTerm(raw: string): string {
  return raw
    .split("·")[0]
    .replace(/\([^)]*\)/g, "")
    .replace(/parcela\s+\d+\s+de\s+\d+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function TransactionRow({ t }: { t: Tx }) {
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [value, setValue] = useState(t.description);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  const b = TYPE_BADGE[t.type];
  const raw = t.rawDescription || t.description;

  if (editing) {
    return (
      <li className="px-5 py-3">
        <div className="flex items-center gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Apelido do estabelecimento"
            className="h-8 flex-1"
            autoFocus
          />
          <button
            onClick={() =>
              start(async () => {
                const r = await renameMerchant(raw, value);
                setMsg(r.message);
                if (r.ok) setEditing(false);
              })
            }
            disabled={pending}
            title="Salvar apelido"
            className="rounded-md bg-primary/15 p-1.5 text-primary hover:bg-primary/25"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setValue(t.description);
            }}
            title="Cancelar"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 px-1 text-[11px] text-muted-foreground">
          Renomeia todos os lançamentos desta loja e vale para as próximas
          importações. Original: <span className="italic">{raw}</span>
        </p>
      </li>
    );
  }

  return (
    <li
      className={`group flex items-center justify-between px-5 py-3 ${
        pending ? "opacity-50" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm">{t.description || b.label}</span>
          <button
            onClick={() => setEditing(true)}
            title="Renomear estabelecimento (apelido)"
            className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(
              searchTerm(raw),
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Buscar no Google"
            className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          >
            <Search className="h-3 w-3" />
          </a>
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDate(t.date)}
          {t.accountName ? ` · ${t.accountName}` : ""}
          {t.categoryName ? ` · ${t.categoryName}` : ""}
          {msg ? ` · ${msg}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-medium ${b.cls}`}>
          {b.sign}
          {formatBRL(Number(t.amount))}
        </span>
        {confirmDel ? (
          <span className="flex items-center gap-1">
            <button
              onClick={() =>
                start(async () => {
                  await deleteTransaction(t.id);
                })
              }
              disabled={pending}
              title="Confirmar exclusão"
              className="rounded-md bg-[var(--negative)]/15 px-2 py-1 text-xs text-[var(--negative)] hover:bg-[var(--negative)]/25"
            >
              Excluir
            </button>
            <button
              onClick={() => setConfirmDel(false)}
              title="Cancelar"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmDel(true)}
            title="Excluir movimentação"
            className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-[var(--negative)] group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}
