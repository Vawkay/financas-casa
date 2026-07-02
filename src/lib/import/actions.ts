"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  account,
  category,
  transaction,
  importBatch,
  categorizationRule,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { parseStatement } from "./parse";
import { classifyAll } from "./classify";
import { suggestWithGemini } from "./ai-gemini";
import { extractPdfText, isPasswordError } from "./pdf-text";
import { extractInvoiceWithGemini } from "./ai-invoice";
import { merchantKey, normalize } from "./merchant";
import { prettyMerchant } from "./merchant-name";
import type { TxKind, TxHint, ClassifiedTx, ParsedTx } from "./types";

/**
 * Consulta razão social na base aberta da RFB via BrasilAPI (gratuita, sem
 * chave). Best-effort: timeout curto e falhas silenciosas — é só enriquecimento.
 */
async function lookupCnpjNames(cnpjs: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(cnpjs.filter(Boolean))].slice(0, 12); // evita abuso
  await Promise.allSettled(
    unique.map(async (cnpj) => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch(
          `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
          { signal: ctrl.signal },
        );
        clearTimeout(t);
        if (!res.ok) return;
        const j = await res.json();
        let name: string = j?.nome_fantasia || j?.razao_social || "";
        // MEI costuma vir como "59.255.066 NOME" — tira a raiz do CNPJ da frente.
        name = name.replace(/^\d{2}\.?\d{3}\.?\d{3}\s+/, "").trim();
        if (name) out.set(cnpj, name);
      } catch {
        /* ignora — enriquecimento opcional */
      }
    }),
  );
  return out;
}

export type StagedRow = {
  opId: string;
  date: string;
  description: string; // nome amigável (embelezado ou apelido do usuário)
  rawDescription: string; // texto original do extrato/fatura
  via: string | null; // intermediário de pagamento (iFood, Mercado Pago…)
  cnpj: string | null; // CNPJ detectado no texto
  cnpjName: string | null; // razão social via consulta à RFB (BrasilAPI)
  amount: number; // com sinal
  balance: number | null;
  kind: TxKind;
  category: string | null;
  hint: TxHint;
  suggestedAccount: string | null;
  confidence: "high" | "medium" | "low";
  ruleName: string;
  duplicate: boolean;
};

/** Aplica as regras que o usuário "ensinou" (categorization_rule). Vencem as built-in. */
async function applyLearnedRules(
  txs: ClassifiedTx[],
  userId: string,
): Promise<ClassifiedTx[]> {
  const rules = await db
    .select({
      pattern: categorizationRule.pattern,
      transactionType: categorizationRule.transactionType,
      categoryId: categorizationRule.categoryId,
      categoryName: category.name,
    })
    .from(categorizationRule)
    .leftJoin(category, eq(categorizationRule.categoryId, category.id))
    .where(
      and(
        eq(categorizationRule.userId, userId),
        eq(categorizationRule.active, true),
      ),
    );
  if (rules.length === 0) return txs;

  return txs.map((t) => {
    const desc = normalize(t.description);
    const rule = rules.find((r) => r.pattern && desc.includes(r.pattern));
    if (!rule) return t;
    // Regra só-de-apelido (sem tipo/categoria) NÃO deve sobrescrever a
    // classificação — só apelidos. Tipo/categoria só mudam quando a regra os tem.
    if (rule.transactionType) {
      return {
        ...t,
        kind: rule.transactionType as TxKind,
        category: rule.transactionType === "TRANSFER" ? null : rule.categoryName,
        ruleName: "aprendida",
        confidence: "high",
      };
    }
    if (rule.categoryId) {
      return { ...t, category: rule.categoryName, ruleName: "aprendida", confidence: "high" };
    }
    return t;
  });
}

/**
 * Junta as dezenas de linhas de cofrinho ("Reserva por gastos") numa única
 * transferência líquida por mês — o usuário não usa cofrinho fixo e elas
 * poluem o extrato. opId sintético determinístico permite dedup em re-imports.
 */
function aggregateCofrinho(rows: ClassifiedTx[]): ClassifiedTx[] {
  const cof = rows.filter((r) => r.hint === "cofrinho");
  if (cof.length === 0) return rows;

  const keep = rows.filter((r) => r.hint !== "cofrinho");
  const byMonth = new Map<string, { sum: number; lastDate: string; n: number }>();
  for (const r of cof) {
    const m = r.date.slice(0, 7);
    const e = byMonth.get(m) ?? { sum: 0, lastDate: r.date, n: 0 };
    e.sum += r.amount;
    e.n++;
    if (r.date > e.lastDate) e.lastDate = r.date;
    byMonth.set(m, e);
  }

  for (const [m, e] of byMonth) {
    keep.push({
      date: e.lastDate,
      description: `Cofrinho — ${e.n} reservas do mês (líquido)`,
      opId: `cofrinho-${m}`,
      amount: Number(e.sum.toFixed(2)),
      balance: undefined,
      kind: "TRANSFER",
      category: null,
      hint: "cofrinho",
      suggestedAccount: null,
      ruleName: "cofrinho_agregado",
      confidence: "high",
    });
  }
  keep.sort((a, b) => a.date.localeCompare(b.date));
  return keep;
}

export async function analyzeStatement(formData: FormData): Promise<{
  ok: boolean;
  message?: string;
  rows?: StagedRow[];
  aiUsed?: boolean;
}> {
  const user = await requireUser();
  const file = formData.get("file") as File | null;
  const useAI = formData.get("useAI") === "on";
  const accountId = String(formData.get("accountId") ?? "");
  // Senha vinda do form é um override opcional; o padrão é a salva na conta.
  const passwordOverride = String(formData.get("password") ?? "");

  if (!file || file.size === 0) return { ok: false, message: "Selecione um arquivo." };

  // O tipo da conta decide o tratamento: cartão/empréstimo = fatura (IA);
  // conta corrente = extrato (parser determinístico).
  const [acc] = accountId
    ? await db
        .select({ type: account.type, password: account.statementPassword })
        .from(account)
        .where(and(eq(account.userId, user.id), eq(account.id, accountId)))
    : [];
  const isInvoice = acc?.type === "CREDIT_CARD" || acc?.type === "LOAN";
  const password = passwordOverride || acc?.password || "";

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsedTxs: ParsedTx[];
  let isInvoiceImport = false;
  try {
    if (isInvoice) {
      const text = await extractPdfText(buffer, password);
      parsedTxs = await extractInvoiceWithGemini(text);
      isInvoiceImport = true;
    } else {
      parsedTxs = (await parseStatement(buffer, file.name)).txs;
    }
  } catch (e) {
    console.error("[analyzeStatement] falha ao ler arquivo:", e);
    if (isPasswordError(e)) {
      return {
        ok: false,
        message: password
          ? "A senha salva não abriu a fatura. Edite a senha desta conta em Carteiras."
          : "Esta conta não tem senha de fatura salva. Cadastre-a em Carteiras (editar conta).",
      };
    }
    const detail = (e as Error)?.message?.trim();
    return {
      ok: false,
      message: detail
        ? `Falha ao ler o arquivo: ${detail}`
        : "Falha ao ler o arquivo. Confira se o arquivo e o tipo da conta estão corretos.",
    };
  }

  // Categorias do usuário (para a IA e para nomear regras aprendidas).
  const cats = await db
    .select({ name: category.name })
    .from(category)
    .where(eq(category.userId, user.id));
  const catNames = cats.map((c) => c.name);

  let classified = classifyAll(parsedTxs);
  classified = await applyLearnedRules(classified, user.id);
  if (!isInvoiceImport) classified = aggregateCofrinho(classified);

  let aiUsed = false;
  if (useAI && process.env.GEMINI_API_KEY) {
    classified = await suggestWithGemini(classified, catNames);
    aiUsed = true;
  }

  // Dedup: opIds já existentes (inclui os agregados sintéticos do cofrinho).
  const opIds = classified.map((t) => t.opId);
  const existing =
    opIds.length > 0
      ? await db
          .select({ fitid: transaction.fitid })
          .from(transaction)
          .where(
            and(eq(transaction.userId, user.id), inArray(transaction.fitid, opIds)),
          )
      : [];
  const existingSet = new Set(existing.map((e) => e.fitid));

  // Apelidos que o usuário já deu a estabelecimentos (vencem o nome automático).
  const aliasRules = await db
    .select({ pattern: categorizationRule.pattern, displayName: categorizationRule.displayName })
    .from(categorizationRule)
    .where(
      and(
        eq(categorizationRule.userId, user.id),
        sql`${categorizationRule.displayName} is not null`,
      ),
    );
  const aliasMap = new Map(aliasRules.map((r) => [r.pattern, r.displayName!]));

  // Embeleza o nome de cada lançamento e extrai CNPJ (linhas sintéticas passam direto).
  const synthetic = (t: ClassifiedTx) =>
    t.ruleName === "cofrinho_agregado" || t.hint === "cofrinho";
  const enriched = classified.map((t) => {
    if (synthetic(t)) {
      return { raw: t.description, display: t.description, via: null, cnpj: null };
    }
    const info = prettyMerchant(t.description);
    const alias = aliasMap.get(merchantKey(t.description));
    return { raw: t.description, display: alias ?? info.display, via: info.via, cnpj: info.cnpj };
  });

  // Consulta CNPJs na RFB (best-effort) e anexa a razão social.
  const cnpjNames = await lookupCnpjNames(
    enriched.map((e) => e.cnpj).filter((c): c is string => Boolean(c)),
  );

  const rows: StagedRow[] = classified.map((t, i) => ({
    opId: t.opId,
    date: t.date,
    description: enriched[i].display,
    rawDescription: enriched[i].raw,
    via: enriched[i].via,
    cnpj: enriched[i].cnpj,
    cnpjName: enriched[i].cnpj ? (cnpjNames.get(enriched[i].cnpj!) ?? null) : null,
    amount: t.amount,
    balance: t.balance ?? null,
    kind: t.kind,
    category: t.category,
    hint: t.hint,
    suggestedAccount: t.suggestedAccount,
    confidence: t.confidence,
    ruleName: t.ruleName,
    duplicate: existingSet.has(t.opId),
  }));

  return { ok: true, rows, aiUsed };
}

export type ApplyRow = {
  opId: string;
  date: string;
  description: string; // nome final exibido (pode ser apelido editado pelo usuário)
  rawDescription: string; // texto original — base p/ aprendizado e dedup
  amount: number; // com sinal
  kind: TxKind;
  accountId: string;
  counterAccountId: string | null;
  categoryId: string | null;
};

/**
 * Define um apelido permanente para um estabelecimento. Atualiza TODOS os
 * lançamentos da mesma loja (mesma merchantKey) e memoriza o apelido para as
 * próximas importações. Apelido vazio limpa o apelido salvo.
 */
export async function renameMerchant(
  rawDescription: string,
  alias: string,
): Promise<{ ok: boolean; message: string; updated?: number }> {
  const user = await requireUser();
  const key = merchantKey(rawDescription);
  const name = alias.trim();
  if (key.length < 3)
    return { ok: false, message: "Não consegui identificar o estabelecimento." };

  // Lançamentos da mesma loja (merchantKey computada em JS sobre o texto original).
  const txs = await db
    .select({
      id: transaction.id,
      raw: transaction.rawDescription,
      description: transaction.description,
    })
    .from(transaction)
    .where(eq(transaction.userId, user.id));
  const ids = txs
    .filter((t) => merchantKey(t.raw || t.description) === key)
    .map((t) => t.id);

  if (name && ids.length > 0) {
    await db
      .update(transaction)
      .set({ description: name })
      .where(and(eq(transaction.userId, user.id), inArray(transaction.id, ids)));
  }

  // Upsert do apelido na regra do estabelecimento.
  const [rule] = await db
    .select({ id: categorizationRule.id })
    .from(categorizationRule)
    .where(
      and(
        eq(categorizationRule.userId, user.id),
        eq(categorizationRule.pattern, key),
      ),
    );
  if (rule) {
    await db
      .update(categorizationRule)
      .set({ displayName: name || null })
      .where(eq(categorizationRule.id, rule.id));
  } else if (name) {
    await db.insert(categorizationRule).values({
      userId: user.id,
      matchType: "KEYWORD",
      pattern: key,
      displayName: name,
      priority: 50,
    });
  }

  revalidatePath("/movimentacoes");
  revalidatePath("/importar");
  revalidatePath("/");
  return {
    ok: true,
    message: name
      ? `Apelido salvo. ${ids.length} lançamento(s) renomeado(s).`
      : "Apelido removido.",
    updated: ids.length,
  };
}

export async function applyImport(
  primaryAccountId: string,
  fileName: string,
  rows: ApplyRow[],
  finalBalance: number | null,
  lastDate: string | null,
): Promise<{ ok: boolean; message: string; inserted?: number }> {
  const user = await requireUser();

  if (!primaryAccountId) return { ok: false, message: "Conta não informada." };
  if (rows.length === 0) return { ok: false, message: "Nada a importar." };

  const [acc] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, user.id), eq(account.id, primaryAccountId)));
  if (!acc) return { ok: false, message: "Conta inválida." };

  // Dedup final.
  const opIds = rows.map((r) => r.opId);
  const existing = await db
    .select({ fitid: transaction.fitid })
    .from(transaction)
    .where(and(eq(transaction.userId, user.id), inArray(transaction.fitid, opIds)));
  const existingSet = new Set(existing.map((e) => e.fitid));
  const fresh = rows.filter((r) => !existingSet.has(r.opId));
  if (fresh.length === 0)
    return { ok: false, message: "Todas as linhas já haviam sido importadas." };

  const dates = fresh.map((r) => r.date).sort();
  const [batch] = await db
    .insert(importBatch)
    .values({
      userId: user.id,
      accountId: primaryAccountId,
      format: fileName.toLowerCase().endsWith(".pdf") ? "PDF" : "CSV",
      fileName,
      periodStart: dates[0],
      periodEnd: dates[dates.length - 1],
      status: "IMPORTED",
      rowCount: fresh.length,
    })
    .returning({ id: importBatch.id });

  await db.insert(transaction).values(
    fresh.map((r) => ({
      userId: user.id,
      date: r.date,
      amount: Math.abs(r.amount).toFixed(2),
      type: r.kind,
      accountId: r.accountId || primaryAccountId,
      counterAccountId: r.kind === "TRANSFER" ? r.counterAccountId : null,
      categoryId: r.kind !== "TRANSFER" ? r.categoryId : null,
      description: r.description,
      rawDescription: r.rawDescription || r.description,
      status: "CONFIRMED" as const,
      source: "IMPORT" as const,
      importBatchId: batch.id,
      fitid: r.opId,
      dedupHash: r.opId,
    })),
  );

  // Saldo: o extrato traz o saldo final (fonte da verdade). Só atualiza se este
  // extrato for o mais recente da conta (evita regredir o saldo com extrato antigo).
  if (finalBalance != null && lastDate) {
    const [{ maxDate }] = await db
      .select({ maxDate: sql<string | null>`max(${transaction.date})` })
      .from(transaction)
      .where(
        and(
          eq(transaction.userId, user.id),
          eq(transaction.accountId, primaryAccountId),
        ),
      );
    if (!maxDate || lastDate >= maxDate) {
      await db
        .update(account)
        .set({ currentBalance: finalBalance.toFixed(2) })
        .where(
          and(eq(account.userId, user.id), eq(account.id, primaryAccountId)),
        );
    }
  }

  // Aprendizado: memoriza a classificação por estabelecimento.
  await learnFromRows(user.id, fresh);

  revalidatePath("/");
  revalidatePath("/movimentacoes");
  revalidatePath("/importar");

  return { ok: true, message: `${fresh.length} transações importadas.`, inserted: fresh.length };
}

/**
 * Memoriza por estabelecimento: a classificação (categoria/transferência) e o
 * APELIDO (quando o usuário renomeou em relação ao nome automático). Tudo na
 * mesma regra, chaveada pela merchantKey do texto original.
 */
async function learnFromRows(userId: string, rows: ApplyRow[]) {
  type Signal = {
    categoryId?: string | null;
    kind?: TxKind;
    displayName?: string;
  };
  const byKey = new Map<string, Signal>();

  for (const r of rows) {
    const raw = r.rawDescription || r.description;
    const key = merchantKey(raw);
    if (key.length < 3) continue;
    const e = byKey.get(key) ?? {};
    if (r.kind === "TRANSFER") e.kind = "TRANSFER";
    else if (r.categoryId) {
      e.kind = r.kind;
      e.categoryId = r.categoryId;
    }
    // Apelido: o usuário mudou o nome em relação ao automático?
    const auto = prettyMerchant(raw).display;
    if (r.description && r.description.trim() && r.description !== auto) {
      e.displayName = r.description.trim();
    }
    byKey.set(key, e);
  }

  const entries = [...byKey].filter(
    ([, e]) => e.kind || e.categoryId || e.displayName,
  );
  if (entries.length === 0) return;

  const existing = await db
    .select({
      id: categorizationRule.id,
      pattern: categorizationRule.pattern,
      displayName: categorizationRule.displayName,
      categoryId: categorizationRule.categoryId,
      transactionType: categorizationRule.transactionType,
    })
    .from(categorizationRule)
    .where(eq(categorizationRule.userId, userId));
  const known = new Map(existing.map((e) => [e.pattern, e]));

  const toInsert: (typeof categorizationRule.$inferInsert)[] = [];
  for (const [key, e] of entries) {
    const ex = known.get(key);
    if (!ex) {
      toInsert.push({
        userId,
        matchType: "KEYWORD",
        pattern: key,
        transactionType: e.kind ?? null,
        categoryId: e.kind === "TRANSFER" ? null : (e.categoryId ?? null),
        displayName: e.displayName ?? null,
        priority: 50,
      });
      continue;
    }
    // Atualiza apenas o que faltava (não sobrescreve classificação já existente).
    const patch: Partial<typeof categorizationRule.$inferInsert> = {};
    if (e.displayName && e.displayName !== ex.displayName)
      patch.displayName = e.displayName;
    if (!ex.transactionType && !ex.categoryId) {
      if (e.kind === "TRANSFER") patch.transactionType = "TRANSFER";
      else if (e.categoryId) {
        patch.transactionType = e.kind ?? null;
        patch.categoryId = e.categoryId;
      }
    }
    if (Object.keys(patch).length > 0) {
      await db
        .update(categorizationRule)
        .set(patch)
        .where(eq(categorizationRule.id, ex.id));
    }
  }
  if (toInsert.length > 0) await db.insert(categorizationRule).values(toInsert);
}
