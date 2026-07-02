"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil, Trash2, Check, X, Plus } from "lucide-react";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export type Cat = {
  id: string;
  name: string;
  color: string | null;
  isSystem: boolean;
};

const DEFAULT_COLOR = "#3ecf8e";

function Swatch({ color }: { color: string | null }) {
  return (
    <span
      className="h-3 w-3 shrink-0 rounded-full border border-border"
      style={{ background: color ?? "#3e3e3e" }}
    />
  );
}

function CategoryRow({ cat }: { cat: Cat }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (editing) {
    return (
      <form
        ref={formRef}
        action={(fd) =>
          start(async () => {
            const r = await updateCategory(fd);
            if (r.ok) setEditing(false);
          })
        }
        className="flex items-center gap-2 rounded-md border border-primary/40 bg-card px-3 py-2"
      >
        <input type="hidden" name="id" value={cat.id} />
        <input
          type="color"
          name="color"
          defaultValue={cat.color ?? DEFAULT_COLOR}
          className="h-7 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent"
          title="Cor"
        />
        <Input
          name="name"
          defaultValue={cat.name}
          className="h-8 flex-1"
          required
          autoFocus
        />
        <button
          type="submit"
          disabled={pending}
          title="Salvar"
          className="rounded-md bg-primary/15 p-1.5 text-primary hover:bg-primary/25"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          title="Cancelar"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </form>
    );
  }

  return (
    <div
      className={`group flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:border-primary/40 ${
        pending ? "opacity-50" : ""
      }`}
    >
      <Swatch color={cat.color} />
      <span className="flex-1 truncate text-sm">{cat.name}</span>
      <button
        onClick={() => setEditing(true)}
        title="Editar"
        className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => start(async () => void (await deleteCategory(cat.id)))}
        disabled={pending}
        title="Excluir"
        className="text-muted-foreground opacity-0 transition-opacity hover:text-[var(--negative)] group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function CategoryManager({ categories }: { categories: Cat[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-5">
      <form
        ref={formRef}
        action={(fd) =>
          start(async () => {
            const r = await createCategory(fd);
            setMsg(r.message);
            if (r.ok) {
              formRef.current?.reset();
            }
          })
        }
        className="flex flex-wrap items-end gap-2"
      >
        <input
          type="color"
          name="color"
          defaultValue={DEFAULT_COLOR}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-border bg-transparent"
          title="Cor da categoria"
        />
        <Input
          name="name"
          placeholder="Nova categoria (ex: Pet, Lazer...)"
          className="min-w-48 flex-1"
          required
        />
        <Button type="submit" disabled={pending}>
          <Plus className="h-4 w-4" />
          {pending ? "Salvando..." : "Adicionar"}
        </Button>
        {msg && (
          <p className="w-full text-sm text-muted-foreground">{msg}</p>
        )}
      </form>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <CategoryRow key={c.id} cat={c} />
        ))}
      </div>
      {categories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma categoria ainda. Crie a primeira acima.
        </p>
      )}
    </div>
  );
}
