"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  account,
  category,
  transaction,
  recurringBill,
  monthlyBillStatus,
  incomeSource,
  monthlyIncome,
  debt,
} from "@/db/schema";
import { monthKey } from "@/lib/utils";
import { requireUser } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/* Seed inicial — contas e categorias do Felipe                       */
/* ------------------------------------------------------------------ */

const SEED_ACCOUNTS: {
  name: string;
  type: "CHECKING" | "CREDIT_CARD" | "LOAN" | "SAVINGS";
  institution: string;
}[] = [
  { name: "Mercado Pago", type: "CHECKING", institution: "Mercado Pago" },
  { name: "Wise", type: "CHECKING", institution: "Wise" },
  { name: "PicPay Empresas", type: "CHECKING", institution: "PicPay" },
  { name: "Cartão Mercado Pago", type: "CREDIT_CARD", institution: "Mercado Pago" },
  { name: "Cartão Santander", type: "CREDIT_CARD", institution: "Santander" },
  { name: "Cartão Pan", type: "CREDIT_CARD", institution: "Banco Pan" },
  { name: "Linha de Crédito Mercado Pago", type: "LOAN", institution: "Mercado Pago" },
];

const SEED_CATEGORIES = [
  "Mercado",
  "Farmácia",
  "Padaria",
  "OutFood",
  "Roupas",
  "Transporte",
  "Outros",
  "Investimento",
  "Aluguel",
  "Plano de Saúde",
  "Impostos",
  "Internet",
  "Energia (Copel)",
  "Água (Sanepar)",
  "Telefonia",
  "Assinaturas",
  "Contabilidade",
];

export async function seedDefaults() {
  const user = await requireUser();

  const existing = await db
    .select({ id: account.id })
    .from(account)
    .where(eq(account.userId, user.id))
    .limit(1);

  if (existing.length > 0) {
    return { ok: false, message: "Você já possui contas cadastradas." };
  }

  await db.insert(account).values(
    SEED_ACCOUNTS.map((a) => ({ ...a, userId: user.id })),
  );
  await db.insert(category).values(
    SEED_CATEGORIES.map((name) => ({ name, userId: user.id, isSystem: true })),
  );

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `${SEED_ACCOUNTS.length} contas e ${SEED_CATEGORIES.length} categorias criadas.`,
  };
}

/* ------------------------------------------------------------------ */
/* Contas                                                             */
/* ------------------------------------------------------------------ */

export async function createAccount(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "CHECKING") as
    | "CHECKING"
    | "CREDIT_CARD"
    | "LOAN"
    | "SAVINGS";
  const institution = String(formData.get("institution") ?? "").trim() || null;
  const balance = String(formData.get("currentBalance") ?? "0").replace(",", ".");
  const limit = String(formData.get("creditLimit") ?? "").replace(",", ".");

  if (!name) return { ok: false, message: "Informe um nome." };

  await db.insert(account).values({
    userId: user.id,
    name,
    type,
    institution,
    currentBalance: balance || "0",
    creditLimit: limit ? limit : null,
  });

  revalidatePath("/contas");
  return { ok: true, message: "Conta criada." };
}

export async function updateAccount(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "CHECKING") as
    | "CHECKING"
    | "CREDIT_CARD"
    | "LOAN"
    | "SAVINGS";
  const institution = String(formData.get("institution") ?? "").trim() || null;
  const balanceRaw = String(formData.get("currentBalance") ?? "").trim();
  const limitRaw = String(formData.get("creditLimit") ?? "").trim();
  const dueDayRaw = String(formData.get("dueDay") ?? "").trim();
  // Senha: campo vazio = manter a atual; valor "-" = limpar.
  const passwordRaw = String(formData.get("statementPassword") ?? "");

  if (!id) return { ok: false, message: "Conta não informada." };
  if (!name) return { ok: false, message: "Informe um nome." };

  const [owned] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, user.id), eq(account.id, id)));
  if (!owned) return { ok: false, message: "Conta inválida." };

  const values: Partial<typeof account.$inferInsert> = {
    name,
    type,
    institution,
    creditLimit: limitRaw ? limitRaw.replace(",", ".") : null,
    dueDay: dueDayRaw ? Number(dueDayRaw) : null,
  };
  if (balanceRaw) values.currentBalance = balanceRaw.replace(",", ".");
  if (passwordRaw === "-") values.statementPassword = null;
  else if (passwordRaw) values.statementPassword = passwordRaw;

  await db
    .update(account)
    .set(values)
    .where(and(eq(account.userId, user.id), eq(account.id, id)));

  revalidatePath("/carteiras");
  revalidatePath("/importar");
  return { ok: true, message: "Conta atualizada." };
}

/* ------------------------------------------------------------------ */
/* Categorias                                                         */
/* ------------------------------------------------------------------ */

export async function createCategory(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim() || null;

  if (!name) return { ok: false, message: "Informe um nome." };

  // Evita duplicatas (case-insensitive) para o mesmo usuário.
  const existing = await db
    .select({ id: category.id })
    .from(category)
    .where(
      and(
        eq(category.userId, user.id),
        sql`lower(${category.name}) = ${name.toLowerCase()}`,
      ),
    );
  if (existing.length > 0)
    return { ok: false, message: "Já existe uma categoria com esse nome." };

  await db.insert(category).values({ userId: user.id, name, color });

  revalidatePath("/categorias");
  revalidatePath("/importar");
  revalidatePath("/contas");
  return { ok: true, message: "Categoria criada." };
}

export async function updateCategory(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim() || null;

  if (!id) return { ok: false, message: "Categoria não informada." };
  if (!name) return { ok: false, message: "Informe um nome." };

  await db
    .update(category)
    .set({ name, color })
    .where(and(eq(category.userId, user.id), eq(category.id, id)));

  revalidatePath("/categorias");
  revalidatePath("/importar");
  revalidatePath("/contas");
  return { ok: true, message: "Categoria atualizada." };
}

export async function deleteCategory(id: string) {
  const user = await requireUser();
  // FKs em transação/contas/regras são ON DELETE SET NULL — seguro remover.
  await db
    .delete(category)
    .where(and(eq(category.userId, user.id), eq(category.id, id)));
  revalidatePath("/categorias");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Transações manuais                                                 */
/* ------------------------------------------------------------------ */

export async function createTransaction(formData: FormData) {
  const user = await requireUser();
  const type = String(formData.get("type") ?? "EXPENSE") as
    | "INCOME"
    | "EXPENSE"
    | "TRANSFER";
  const date = String(formData.get("date") ?? "");
  const amount = String(formData.get("amount") ?? "0").replace(",", ".");
  const description = String(formData.get("description") ?? "").trim();
  const accountId = String(formData.get("accountId") ?? "");
  const counterAccountId = String(formData.get("counterAccountId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");

  if (!date || !amount || Number(amount) <= 0) {
    return { ok: false, message: "Informe data e valor válidos." };
  }
  if (!accountId) return { ok: false, message: "Selecione a conta." };

  // Garante que as contas pertencem ao usuário (defesa extra além do RLS).
  const owned = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, user.id), eq(account.id, accountId)));
  if (owned.length === 0) return { ok: false, message: "Conta inválida." };

  await db.insert(transaction).values({
    userId: user.id,
    date,
    amount,
    type,
    accountId,
    counterAccountId:
      type === "TRANSFER" && counterAccountId ? counterAccountId : null,
    categoryId: type !== "TRANSFER" && categoryId ? categoryId : null,
    description,
    source: "MANUAL",
    status: "CONFIRMED",
  });

  revalidatePath("/");
  revalidatePath("/movimentacoes");
  return { ok: true, message: "Lançamento adicionado." };
}

/* ------------------------------------------------------------------ */
/* Fontes de renda (composição do saldo possível)                     */
/* ------------------------------------------------------------------ */

/** Define o valor de uma fonte de renda num mês (upsert). */
export async function setIncomeAmount(
  month: string,
  incomeSourceId: string,
  value: number,
) {
  const user = await requireUser();
  if (!/^\d{4}-\d{2}$/.test(month))
    return { ok: false, message: "Mês inválido." };
  if (!incomeSourceId) return { ok: false, message: "Fonte não informada." };
  const amount = (Number.isFinite(value) ? Math.max(0, value) : 0).toFixed(2);

  await db
    .insert(monthlyIncome)
    .values({ userId: user.id, month, incomeSourceId, amount })
    .onConflictDoUpdate({
      target: [
        monthlyIncome.userId,
        monthlyIncome.month,
        monthlyIncome.incomeSourceId,
      ],
      set: { amount },
    });

  revalidatePath("/contas");
  return { ok: true, message: "Valor salvo." };
}

export async function addIncomeSource(name: string, via?: string) {
  const user = await requireUser();
  const n = name.trim();
  if (!n) return { ok: false, message: "Informe o nome da fonte." };
  await db.insert(incomeSource).values({
    userId: user.id,
    name: n,
    via: via?.trim() || null,
  });
  revalidatePath("/contas");
  return { ok: true, message: "Fonte adicionada." };
}

export async function renameIncomeSource(
  id: string,
  name: string,
  via?: string,
  variable?: boolean,
) {
  const user = await requireUser();
  const n = name.trim();
  if (!id || !n) return { ok: false, message: "Dados inválidos." };
  await db
    .update(incomeSource)
    .set({ name: n, via: via?.trim() || null, kind: variable ? "PJ_HOURLY" : "OTHER" })
    .where(and(eq(incomeSource.userId, user.id), eq(incomeSource.id, id)));
  revalidatePath("/contas");
  return { ok: true, message: "Fonte atualizada." };
}

export async function deleteIncomeSource(id: string) {
  const user = await requireUser();
  // Marca como inativa (preserva histórico de meses anteriores).
  await db
    .update(incomeSource)
    .set({ active: false })
    .where(and(eq(incomeSource.userId, user.id), eq(incomeSource.id, id)));
  revalidatePath("/contas");
  return { ok: true, message: "Fonte removida." };
}

/** Exclui uma movimentação. Não recalcula saldo (ele vem do extrato). */
export async function deleteTransaction(id: string) {
  const user = await requireUser();
  if (!id) return { ok: false, message: "Movimentação não informada." };
  await db
    .delete(transaction)
    .where(and(eq(transaction.id, id), eq(transaction.userId, user.id)));
  revalidatePath("/");
  revalidatePath("/movimentacoes");
  return { ok: true, message: "Movimentação excluída." };
}

/* ------------------------------------------------------------------ */
/* Contas do mês                                                      */
/* ------------------------------------------------------------------ */

const TOGGLE_STATUS: Record<string, "A_PAGAR" | "PAGO"> = {
  A_PAGAR: "PAGO",
  RESERVADO: "PAGO",
  PAGO: "A_PAGAR",
};

export async function addMonthlyBill(formData: FormData) {
  const user = await requireUser();
  const month = String(formData.get("month") ?? monthKey());
  const name = String(formData.get("name") ?? "").trim();
  const amount = String(formData.get("amount") ?? "0").replace(",", ".");
  const dueDayRaw = String(formData.get("dueDay") ?? "").trim();
  const dueDay = dueDayRaw ? Number(dueDayRaw) : null;
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const status = String(formData.get("status") ?? "A_PAGAR") as
    | "A_PAGAR"
    | "RESERVADO"
    | "PAGO";
  const recurring = formData.get("recurring") === "on";
  const instNoRaw = String(formData.get("installmentNo") ?? "").trim();
  const instTotalRaw = String(formData.get("installmentTotal") ?? "").trim();
  const installmentNo = instNoRaw ? Number(instNoRaw) : null;
  const installmentTotal = instTotalRaw ? Number(instTotalRaw) : null;

  if (!name) return { ok: false, message: "Informe o nome da conta." };
  if (!amount || Number(amount) <= 0)
    return { ok: false, message: "Informe um valor válido." };

  let recurringBillId: string | null = null;
  if (recurring) {
    const [rb] = await db
      .insert(recurringBill)
      .values({
        userId: user.id,
        name,
        defaultAmount: amount,
        dueDay,
        categoryId,
        installmentTotal,
      })
      .returning({ id: recurringBill.id });
    recurringBillId = rb.id;
  }

  await db.insert(monthlyBillStatus).values({
    userId: user.id,
    month,
    recurringBillId,
    name,
    amount,
    dueDay,
    categoryId,
    status,
    installmentNo,
    installmentTotal,
  });

  revalidatePath("/contas");
  revalidatePath("/");
  return { ok: true, message: "Conta adicionada ao mês." };
}

export async function cycleBillStatus(id: string) {
  const user = await requireUser();
  const [row] = await db
    .select({ status: monthlyBillStatus.status })
    .from(monthlyBillStatus)
    .where(
      and(eq(monthlyBillStatus.id, id), eq(monthlyBillStatus.userId, user.id)),
    );
  if (!row) return { ok: false, message: "Conta não encontrada." };

  await db
    .update(monthlyBillStatus)
    .set({ status: TOGGLE_STATUS[row.status] })
    .where(
      and(eq(monthlyBillStatus.id, id), eq(monthlyBillStatus.userId, user.id)),
    );

  revalidatePath("/contas");
  revalidatePath("/");
  return { ok: true };
}

export async function toggleBillReservado(id: string) {
  const user = await requireUser();
  const [row] = await db
    .select({ status: monthlyBillStatus.status })
    .from(monthlyBillStatus)
    .where(
      and(eq(monthlyBillStatus.id, id), eq(monthlyBillStatus.userId, user.id)),
    );
  if (!row || row.status === "PAGO") return { ok: false };

  const next = row.status === "RESERVADO" ? "A_PAGAR" : "RESERVADO";
  await db
    .update(monthlyBillStatus)
    .set({ status: next })
    .where(
      and(eq(monthlyBillStatus.id, id), eq(monthlyBillStatus.userId, user.id)),
    );

  revalidatePath("/contas");
  revalidatePath("/");
  return { ok: true };
}

export async function updateMonthlyBill(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const amount = String(formData.get("amount") ?? "0").replace(",", ".");
  const dueDayRaw = String(formData.get("dueDay") ?? "").trim();
  const dueDay = dueDayRaw ? Number(dueDayRaw) : null;
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const instNoRaw = String(formData.get("installmentNo") ?? "").trim();
  const instTotalRaw = String(formData.get("installmentTotal") ?? "").trim();
  const installmentNo = instNoRaw ? Number(instNoRaw) : null;
  const installmentTotal = instTotalRaw ? Number(instTotalRaw) : null;
  // Por padrão o valor é só deste mês; marque para virar o padrão dos próximos.
  const applyAmountForward = formData.get("applyAmountForward") === "on";

  if (!name) return { ok: false, message: "Informe o nome." };
  if (!amount || Number(amount) <= 0)
    return { ok: false, message: "Valor inválido." };

  const [row] = await db
    .select({ recurringBillId: monthlyBillStatus.recurringBillId })
    .from(monthlyBillStatus)
    .where(
      and(eq(monthlyBillStatus.id, id), eq(monthlyBillStatus.userId, user.id)),
    );
  if (!row) return { ok: false, message: "Conta não encontrada." };

  // Atualiza apenas ESTE mês (meses passados são linhas independentes).
  await db
    .update(monthlyBillStatus)
    .set({ name, amount, dueDay, categoryId, installmentNo, installmentTotal })
    .where(
      and(eq(monthlyBillStatus.id, id), eq(monthlyBillStatus.userId, user.id)),
    );

  // No modelo recorrente, sincroniza nome/vencimento/categoria (identidade).
  // O valor padrão (usado ao gerar meses futuros) só muda se pedido.
  if (row.recurringBillId) {
    await db
      .update(recurringBill)
      .set({
        name,
        dueDay,
        categoryId,
        installmentTotal,
        ...(applyAmountForward ? { defaultAmount: amount } : {}),
      })
      .where(
        and(
          eq(recurringBill.id, row.recurringBillId),
          eq(recurringBill.userId, user.id),
        ),
      );
  }

  revalidatePath("/contas");
  revalidatePath("/");
  return { ok: true, message: "Conta atualizada." };
}

export async function deleteMonthlyBill(id: string) {
  const user = await requireUser();
  await db
    .delete(monthlyBillStatus)
    .where(
      and(eq(monthlyBillStatus.id, id), eq(monthlyBillStatus.userId, user.id)),
    );
  revalidatePath("/contas");
  revalidatePath("/");
  return { ok: true };
}

/** Gera as instâncias do mês a partir das contas recorrentes ativas. */
export async function generateMonthFromRecurring(month: string) {
  const user = await requireUser();

  const recurrents = await db
    .select()
    .from(recurringBill)
    .where(
      and(eq(recurringBill.userId, user.id), eq(recurringBill.active, true)),
    );

  const existing = await db
    .select({ rid: monthlyBillStatus.recurringBillId })
    .from(monthlyBillStatus)
    .where(
      and(
        eq(monthlyBillStatus.userId, user.id),
        eq(monthlyBillStatus.month, month),
      ),
    );
  const present = new Set(existing.map((e) => e.rid).filter(Boolean));

  // Para contas parceladas, a parcela atual = nº de instâncias já existentes + 1.
  const counts = await db
    .select({
      rid: monthlyBillStatus.recurringBillId,
      n: sql<number>`count(*)::int`,
    })
    .from(monthlyBillStatus)
    .where(eq(monthlyBillStatus.userId, user.id))
    .groupBy(monthlyBillStatus.recurringBillId);
  const countByRid = new Map(counts.map((c) => [c.rid, c.n]));

  const toInsert = recurrents
    .filter((r) => !present.has(r.id))
    .map((r) => {
      const installmentNo = r.installmentTotal
        ? (countByRid.get(r.id) ?? 0) + 1
        : null;
      return {
        userId: user.id,
        month,
        recurringBillId: r.id,
        name: r.name,
        amount: r.defaultAmount,
        dueDay: r.dueDay,
        categoryId: r.categoryId,
        status: "A_PAGAR" as const,
        installmentNo,
        installmentTotal: r.installmentTotal,
      };
    })
    // Não gera parcela além do total (financiamento já quitado).
    .filter((b) => !b.installmentTotal || (b.installmentNo ?? 0) <= b.installmentTotal);

  if (toInsert.length > 0) await db.insert(monthlyBillStatus).values(toInsert);

  // Desativa recorrentes parceladas que chegaram ao fim.
  for (const r of recurrents) {
    if (r.installmentTotal && (countByRid.get(r.id) ?? 0) >= r.installmentTotal) {
      await db
        .update(recurringBill)
        .set({ active: false })
        .where(eq(recurringBill.id, r.id));
    }
  }

  revalidatePath("/contas");
  return { ok: true, message: `${toInsert.length} contas geradas.` };
}

/** Contas fixas recorrentes da planilha (Junho/2026 como referência). */
const SEED_RECURRING: {
  name: string;
  amount: string;
  dueDay: number;
  category: string;
}[] = [
  { name: "Aluguel", amount: "1180", dueDay: 20, category: "Aluguel" },
  { name: "Impostos", amount: "1200", dueDay: 8, category: "Impostos" },
  { name: "Plano de Saúde", amount: "344", dueDay: 10, category: "Plano de Saúde" },
  { name: "Copel", amount: "295", dueDay: 10, category: "Energia (Copel)" },
  { name: "Contabilizei", amount: "255", dueDay: 15, category: "Contabilidade" },
  { name: "Sanepar", amount: "178", dueDay: 10, category: "Água (Sanepar)" },
  { name: "Mãe Guia INSS", amount: "178", dueDay: 10, category: "Outros" },
  { name: "Internet", amount: "99.90", dueDay: 10, category: "Internet" },
  { name: "TIM Felipe", amount: "70", dueDay: 10, category: "Telefonia" },
  { name: "TIM Katia", amount: "61.99", dueDay: 10, category: "Telefonia" },
];

export async function seedRecurringBills() {
  const user = await requireUser();

  const exists = await db
    .select({ id: recurringBill.id })
    .from(recurringBill)
    .where(eq(recurringBill.userId, user.id))
    .limit(1);
  if (exists.length > 0)
    return { ok: false, message: "Você já tem contas recorrentes." };

  const cats = await db
    .select({ id: category.id, name: category.name })
    .from(category)
    .where(eq(category.userId, user.id));
  const catId = (name: string) => cats.find((c) => c.name === name)?.id ?? null;

  const inserted = await db
    .insert(recurringBill)
    .values(
      SEED_RECURRING.map((r) => ({
        userId: user.id,
        name: r.name,
        defaultAmount: r.amount,
        dueDay: r.dueDay,
        categoryId: catId(r.category),
      })),
    )
    .returning({
      id: recurringBill.id,
      name: recurringBill.name,
      amount: recurringBill.defaultAmount,
      dueDay: recurringBill.dueDay,
      categoryId: recurringBill.categoryId,
    });

  const month = monthKey();
  await db.insert(monthlyBillStatus).values(
    inserted.map((r) => ({
      userId: user.id,
      month,
      recurringBillId: r.id,
      name: r.name,
      amount: r.amount,
      dueDay: r.dueDay,
      categoryId: r.categoryId,
      status: "A_PAGAR" as const,
    })),
  );

  revalidatePath("/contas");
  revalidatePath("/");
  return {
    ok: true,
    message: `${inserted.length} contas fixas criadas e geradas para ${month}.`,
  };
}

/* ------------------------------------------------------------------ */
/* Dívidas                                                            */
/* ------------------------------------------------------------------ */

export async function createDebt(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const direction = String(formData.get("direction") ?? "TAKEN") as
    | "TAKEN"
    | "GIVEN";
  const principalTotal = String(formData.get("principalTotal") ?? "0").replace(
    ",",
    ".",
  );
  const amountPaid = String(formData.get("amountPaid") ?? "0").replace(",", ".");
  const installmentsRaw = String(formData.get("installments") ?? "").trim();
  const installments = installmentsRaw ? Number(installmentsRaw) : null;
  const counterpartyName =
    String(formData.get("counterpartyName") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) return { ok: false, message: "Informe o nome da dívida." };
  if (!principalTotal || Number(principalTotal) <= 0)
    return { ok: false, message: "Informe o valor total." };

  await db.insert(debt).values({
    userId: user.id,
    name,
    direction,
    principalTotal,
    amountPaid: amountPaid || "0",
    installments,
    counterpartyName,
    notes,
  });

  revalidatePath("/dividas");
  return { ok: true, message: "Dívida cadastrada." };
}

/** Registra um pagamento, incrementando o valor pago (limitado ao total). */
export async function registerDebtPayment(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const amount = Number(
    String(formData.get("amount") ?? "0").replace(",", "."),
  );
  if (!id || !amount || amount <= 0)
    return { ok: false, message: "Valor inválido." };

  const [d] = await db
    .select({ total: debt.principalTotal, paid: debt.amountPaid })
    .from(debt)
    .where(and(eq(debt.id, id), eq(debt.userId, user.id)));
  if (!d) return { ok: false, message: "Dívida não encontrada." };

  const newPaid = Math.min(Number(d.total), Number(d.paid) + amount);
  const stillActive = newPaid < Number(d.total);

  await db
    .update(debt)
    .set({ amountPaid: newPaid.toFixed(2), active: stillActive })
    .where(and(eq(debt.id, id), eq(debt.userId, user.id)));

  revalidatePath("/dividas");
  return {
    ok: true,
    message: stillActive ? "Pagamento registrado." : "Dívida quitada! 🎉",
  };
}

export async function deleteDebt(id: string) {
  const user = await requireUser();
  await db.delete(debt).where(and(eq(debt.id, id), eq(debt.userId, user.id)));
  revalidatePath("/dividas");
  return { ok: true };
}
