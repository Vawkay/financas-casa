"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Sparkles, Upload, Check, Loader2, Search } from "lucide-react";
import {
  analyzeStatement,
  applyImport,
  type StagedRow,
  type ApplyRow,
} from "@/lib/import/actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Card, CardContent } from "@/components/ui/card";
import { formatBRL, formatDate } from "@/lib/utils";

type Opt = { id: string; name: string; type?: string; hasPassword?: boolean };

type Editable = StagedRow & {
  include: boolean;
  categoryId: string | null;
  counterAccountId: string | null;
};

const KIND_LABEL: Record<string, string> = {
  INCOME: "Receita",
  EXPENSE: "Despesa",
  TRANSFER: "Transferência",
};

/** Só o estabelecimento p/ buscar: sem o portador (· Nome) e sem a parcela. */
function searchTerm(raw: string): string {
  return raw
    .split("·")[0]
    .replace(/\([^)]*\)/g, "")
    .replace(/parcela\s+\d+\s+de\s+\d+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function ImportClient({
  accounts,
  categories,
  hasAI,
}: {
  accounts: Opt[];
  categories: Opt[];
  hasAI: boolean;
}) {
  const catByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.name, c.id);
    return m;
  }, [categories]);

  const accByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts) m.set(a.name, a.id);
    return m;
  }, [accounts]);

  const [rows, setRows] = useState<Editable[] | null>(null);
  const [primaryAccount, setPrimaryAccount] = useState(
    accounts.find((a) => a.name.includes("Mercado Pago"))?.id ?? accounts[0]?.id ?? "",
  );
  const [fileName, setFileName] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  // Progresso: como a server action é atômica, mostramos fases que avançam
  // num ritmo plausível enquanto o trabalho roda (feedback de "está vivo").
  const [action, setAction] = useState<"read" | "ai" | "apply" | null>(null);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [seconds, setSeconds] = useState(0);
  // opIds que a IA acabou de alterar — para o flash verde na revisão.
  const [flashed, setFlashed] = useState<Set<string>>(new Set());

  const selectedAccount = accounts.find((a) => a.id === primaryAccount);
  const isInvoice =
    selectedAccount?.type === "CREDIT_CARD" || selectedAccount?.type === "LOAN";
  const missingPassword = isInvoice && !selectedAccount?.hasPassword;

  const PHASES: Record<"read" | "ai" | "apply", string[]> = {
    read: isInvoice
      ? [
          "Desbloqueando o PDF da fatura…",
          "Lendo os lançamentos…",
          "A IA está extraindo as compras…",
          "Aplicando suas regras…",
          "Verificando duplicadas…",
        ]
      : [
          "Lendo o arquivo…",
          "Aplicando regras de categorização…",
          "Agregando cofrinho do mês…",
          "Consultando a IA…",
          "Verificando duplicadas…",
        ],
    ai: [
      "A IA está lendo cada lançamento…",
      "Classificando por estabelecimento…",
      "Aplicando as sugestões…",
    ],
    apply: [
      "Gravando as transações…",
      "Atualizando o saldo da conta…",
      "Aprendendo suas classificações…",
    ],
  };

  // Fase "longa" onde a animação deve segurar (o gargalo real é a chamada à IA,
  // que leva dezenas de segundos): avançar até lá e ficar, em vez de correr até
  // o fim e parecer travado. A barra indeterminada continua sinalizando vida.
  const HOLD: Record<"read" | "ai" | "apply", number> = {
    read: isInvoice ? 2 : 3, // "IA extraindo as compras" / "Consultando a IA"
    ai: 0, // "IA está lendo cada lançamento"
    apply: 2, // apply é rápido — pode percorrer até o fim
  };

  // Avança as fases enquanto há trabalho em andamento (a partir de phaseIdx 0,
  // que os handlers reiniciam ao disparar a ação).
  useEffect(() => {
    if (!pending || !action) return;
    const steps = PHASES[action];
    const hold = Math.min(HOLD[action], steps.length - 1);
    const id = setInterval(() => {
      setPhaseIdx((i) => (i < hold ? i + 1 : i));
    }, 900);
    const sec = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      clearInterval(id);
      clearInterval(sec);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, action]);

  /** Dispara uma ação com progresso: reinicia a fase, marca a ação e roda. */
  function runWith(kind: "read" | "ai" | "apply", work: () => Promise<void>) {
    setPhaseIdx(0);
    setSeconds(0);
    setAction(kind);
    start(async () => {
      try {
        await work();
      } finally {
        setAction(null);
      }
    });
  }

  function toEditable(staged: StagedRow[]): Editable[] {
    return staged.map((r) => ({
      ...r,
      include: !r.duplicate,
      categoryId: r.category ? (catByName.get(r.category) ?? null) : null,
      // Pré-seleciona o destino da transferência pela sugestão do classificador.
      counterAccountId: r.suggestedAccount
        ? (accByName.get(r.suggestedAccount) ?? null)
        : null,
    }));
  }

  function onAnalyze(useAI: boolean) {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMsg("Selecione um arquivo de extrato.");
      return;
    }
    setFileName(file.name);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("accountId", primaryAccount);
    if (useAI) fd.set("useAI", "on");
    fd.set("categories", categories.map((c) => c.name).join("|"));
    const kind = useAI && rows ? "ai" : "read";
    setFlashed(new Set());
    // Snapshot do que a IA pode mudar (classificação atual por opId).
    const before = new Map(
      (rows ?? []).map((r) => [r.opId, `${r.kind}|${r.category ?? ""}`]),
    );
    runWith(kind, async () => {
      const r = await analyzeStatement(fd);
      if (!r.ok || !r.rows) {
        setMsg(r.message ?? "Falha ao ler o arquivo.");
        return;
      }
      const next = toEditable(r.rows);
      setRows(next);

      // Destaca as linhas que a IA reclassificou em relação ao estado anterior.
      if (useAI && before.size > 0) {
        const changed = new Set<string>();
        for (const r2 of next) {
          const prev = before.get(r2.opId);
          if (prev && prev !== `${r2.kind}|${r2.category ?? ""}`) {
            changed.add(r2.opId);
          }
        }
        setFlashed(changed);
        window.setTimeout(() => setFlashed(new Set()), 1600);
      }

      const dups = r.rows.filter((x) => x.duplicate).length;
      const changedCount = useAI
        ? next.filter(
            (r2) =>
              before.get(r2.opId) &&
              before.get(r2.opId) !== `${r2.kind}|${r2.category ?? ""}`,
          ).length
        : 0;
      setMsg(
        `${r.rows.length} transações lidas` +
          (dups ? ` · ${dups} já importadas (desmarcadas)` : "") +
          (r.aiUsed
            ? changedCount
              ? ` · IA ajustou ${changedCount}`
              : " · IA aplicada"
            : ""),
      );
    });
  }

  function patch(i: number, p: Partial<Editable>) {
    setRows((prev) =>
      prev ? prev.map((r, idx) => (idx === i ? { ...r, ...p } : r)) : prev,
    );
  }

  function onApply() {
    if (!rows) return;
    const payload: ApplyRow[] = rows
      .filter((r) => r.include)
      .map((r) => ({
        opId: r.opId,
        date: r.date,
        description: r.description,
        rawDescription: r.rawDescription,
        amount: r.amount,
        kind: r.kind,
        accountId: primaryAccount,
        counterAccountId: r.counterAccountId,
        categoryId: r.categoryId,
      }));

    // Saldo final do extrato = saldo da última linha (mais recente).
    let finalBalance: number | null = null;
    let lastDate: string | null = null;
    for (const r of rows) {
      if (!lastDate || r.date >= lastDate) {
        lastDate = r.date;
        if (r.balance != null) finalBalance = r.balance;
      }
    }

    runWith("apply", async () => {
      const r = await applyImport(
        primaryAccount,
        fileName,
        payload,
        finalBalance,
        lastDate,
      );
      setMsg(r.message);
      if (r.ok) setRows(null);
    });
  }

  const selected = rows?.filter((r) => r.include).length ?? 0;

  return (
    <div className="space-y-5">
      {/* Upload */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <div className="lg:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {isInvoice ? "Fatura (PDF)" : "Extrato (CSV ou PDF)"}
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.pdf,.xlsx"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-[#2a2a2a] file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-[#323232]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Conta
              </label>
              <Select
                value={primaryAccount}
                onChange={(e) => setPrimaryAccount(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => onAnalyze(false)}
                disabled={pending || missingPassword}
                className="flex-1"
              >
                {pending && action === "read" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {pending && action === "read"
                  ? isInvoice
                    ? "Lendo fatura..."
                    : "Lendo..."
                  : isInvoice
                    ? "Ler fatura (IA)"
                    : "Ler extrato"}
              </Button>
            </div>
          </div>
          {isInvoice ? (
            missingPassword ? (
              <p className="text-xs text-[var(--warning)]">
                Esta conta não tem a senha do PDF salva. Cadastre em{" "}
                <a href="/carteiras" className="underline">
                  Carteiras
                </a>{" "}
                (editar conta) para desbloquear a fatura automaticamente.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Fatura de cartão: o PDF é desbloqueado com a senha salva na conta
                e a IA extrai as compras. As linhas de &ldquo;pagamento de
                fatura&rdquo; são ignoradas (já entram pelo extrato da conta como
                transferência). A senha pode ser alterada em{" "}
                <a href="/carteiras" className="underline">
                  Carteiras
                </a>
                .
              </p>
            )
          ) : (
            hasAI && (
              <p className="text-xs text-muted-foreground">
                Dica: após ler, use{" "}
                <span className="text-primary">Sugerir com IA</span> para
                categorizar o que as regras não resolveram.
              </p>
            )
          )}
          {pending && action ? (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>
                  {PHASES[action][Math.min(phaseIdx, PHASES[action].length - 1)]}
                </span>
                <span className="ml-auto tabular-nums text-xs text-muted-foreground">
                  {seconds}s
                </span>
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-primary/10">
                <div className="h-full w-1/2 rounded-full bg-primary animate-indeterminate" />
              </div>
              {(action === "ai" || (action === "read" && isInvoice)) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  A leitura por IA pode levar até ~1 min para faturas longas.
                  Pode deixar rolando.
                </p>
              )}
            </div>
          ) : (
            msg && <p className="text-sm text-muted-foreground">{msg}</p>
          )}
        </CardContent>
      </Card>

      {/* Revisão */}
      {rows && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-medium">
                Revisão · {selected} de {rows.length} selecionadas
              </span>
              <div className="flex gap-2">
                {hasAI && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onAnalyze(true)}
                    disabled={pending}
                  >
                    {pending && action === "ai" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {pending && action === "ai" ? "IA trabalhando..." : "Sugerir com IA"}
                  </Button>
                )}
                <Button size="sm" onClick={onApply} disabled={pending || selected === 0}>
                  {pending && action === "apply" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {pending && action === "apply"
                    ? "Importando..."
                    : `Importar ${selected}`}
                </Button>
              </div>
            </div>

            <div
              className={`max-h-[60vh] overflow-auto transition-opacity ${
                pending && action === "ai" ? "opacity-60" : ""
              }`}
            >
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="w-8 px-3 py-2" />
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Descrição</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Categoria / Destino</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={r.opId + i}
                      className={`border-b border-border/50 ${
                        r.include ? "" : "opacity-40"
                      } ${flashed.has(r.opId) ? "animate-ai-flash" : ""}`}
                    >
                      <td className="px-3 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={r.include}
                          onChange={(e) => patch(i, { include: e.target.checked })}
                          className="accent-[var(--primary)]"
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                        {formatDate(r.date)}
                      </td>
                      <td className="max-w-72 px-3 py-1.5">
                        <input
                          value={r.description}
                          onChange={(e) => patch(i, { description: e.target.value })}
                          placeholder="—"
                          title="Clique para renomear (vira apelido permanente)"
                          className="w-full truncate rounded bg-transparent px-1 py-0.5 text-sm outline-none focus:bg-muted/50"
                        />
                        <div className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                          {r.rawDescription &&
                            r.rawDescription !== r.description && (
                              <span
                                className="max-w-36 truncate"
                                title={r.rawDescription}
                              >
                                {r.rawDescription}
                              </span>
                            )}
                          {r.via && <span className="shrink-0">via {r.via}</span>}
                          {r.cnpjName && (
                            <span
                              className="max-w-36 shrink-0 truncate text-primary"
                              title={`Razão social (RFB): ${r.cnpjName}`}
                            >
                              · {r.cnpjName}
                            </span>
                          )}
                          {r.rawDescription && (
                            <a
                              href={`https://www.google.com/search?q=${encodeURIComponent(
                                searchTerm(r.rawDescription),
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Buscar este lançamento no Google"
                              className="shrink-0 hover:text-foreground"
                            >
                              <Search className="inline h-3 w-3" />
                            </a>
                          )}
                          {r.duplicate && (
                            <span className="shrink-0 rounded bg-[var(--warning)]/15 px-1.5 py-0.5 text-[10px] text-[var(--warning)]">
                              duplicada
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${
                          r.amount >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"
                        }`}
                      >
                        {formatBRL(Math.abs(r.amount))}
                      </td>
                      <td className="px-3 py-1.5">
                        <Select
                          value={r.kind}
                          onChange={(e) =>
                            patch(i, { kind: e.target.value as StagedRow["kind"] })
                          }
                          className="h-8 py-1 text-xs"
                        >
                          {Object.entries(KIND_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-1.5">
                        {r.kind === "TRANSFER" ? (
                          <Select
                            value={r.counterAccountId ?? ""}
                            onChange={(e) =>
                              patch(i, { counterAccountId: e.target.value || null })
                            }
                            className="h-8 py-1 text-xs"
                          >
                            <option value="">Destino (opcional)</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Select
                            value={r.categoryId ?? ""}
                            onChange={(e) =>
                              patch(i, { categoryId: e.target.value || null })
                            }
                            className="h-8 py-1 text-xs"
                          >
                            <option value="">Sem categoria</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </Select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
