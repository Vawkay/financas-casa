import "server-only";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
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
import { requireUser } from "@/lib/auth";
import { monthKey } from "@/lib/utils";

/** Limites de data (string YYYY-MM-DD) de um mês YYYY-MM. */
function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { start, end: `${next}-01` };
}

export async function getAccounts() {
  const user = await requireUser();
  return db
    .select()
    .from(account)
    .where(and(eq(account.userId, user.id), eq(account.archived, false)))
    .orderBy(account.createdAt);
}

export async function getCategories() {
  const user = await requireUser();
  return db
    .select()
    .from(category)
    .where(eq(category.userId, user.id))
    .orderBy(category.name);
}

/** Resumo do mês: receitas, gastos (despesas) e saldo das contas. */
export async function getMonthSummary(month: string = monthKey()) {
  const user = await requireUser();
  const { start, end } = monthRange(month);

  const [agg] = await db
    .select({
      income: sql<string>`coalesce(sum(case when ${transaction.type} = 'INCOME' then ${transaction.amount} else 0 end), 0)`,
      expense: sql<string>`coalesce(sum(case when ${transaction.type} = 'EXPENSE' then ${transaction.amount} else 0 end), 0)`,
    })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, user.id),
        gte(transaction.date, start),
        lt(transaction.date, end),
      ),
    );

  const [bal] = await db
    .select({
      total: sql<string>`coalesce(sum(${account.currentBalance}), 0)`,
    })
    .from(account)
    .where(
      and(
        eq(account.userId, user.id),
        eq(account.type, "CHECKING"),
        eq(account.archived, false),
      ),
    );

  const income = Number(agg.income);
  const expense = Number(agg.expense);
  return {
    income,
    expense,
    net: income - expense,
    cashBalance: Number(bal.total),
  };
}

/** Transações recentes com nomes de conta e categoria. */
export async function getRecentTransactions(limit = 30) {
  const user = await requireUser();

  return db
    .select({
      id: transaction.id,
      date: transaction.date,
      amount: transaction.amount,
      type: transaction.type,
      description: transaction.description,
      rawDescription: transaction.rawDescription,
      accountName: account.name,
      categoryName: category.name,
    })
    .from(transaction)
    .leftJoin(account, eq(transaction.accountId, account.id))
    .leftJoin(category, eq(transaction.categoryId, category.id))
    .where(eq(transaction.userId, user.id))
    .orderBy(desc(transaction.date), desc(transaction.createdAt))
    .limit(limit);
}

/* ------------------------------------------------------------------ */
/* Contas do mês                                                      */
/* ------------------------------------------------------------------ */

export async function getMonthlyBills(month: string = monthKey()) {
  const user = await requireUser();
  return db
    .select({
      id: monthlyBillStatus.id,
      name: monthlyBillStatus.name,
      amount: monthlyBillStatus.amount,
      dueDay: monthlyBillStatus.dueDay,
      status: monthlyBillStatus.status,
      installmentNo: monthlyBillStatus.installmentNo,
      installmentTotal: monthlyBillStatus.installmentTotal,
      categoryId: monthlyBillStatus.categoryId,
      categoryName: category.name,
    })
    .from(monthlyBillStatus)
    .leftJoin(category, eq(monthlyBillStatus.categoryId, category.id))
    .where(
      and(
        eq(monthlyBillStatus.userId, user.id),
        eq(monthlyBillStatus.month, month),
      ),
    )
    .orderBy(desc(monthlyBillStatus.amount));
}

/* ------------------------------------------------------------------ */
/* Dívidas                                                            */
/* ------------------------------------------------------------------ */

export async function getDebts() {
  const user = await requireUser();
  return db
    .select()
    .from(debt)
    .where(eq(debt.userId, user.id))
    .orderBy(desc(debt.active), desc(debt.principalTotal));
}

/* ------------------------------------------------------------------ */
/* Completude da importação (contas × meses)                          */
/* ------------------------------------------------------------------ */

export async function getCoverage(monthsBack = 6) {
  const user = await requireUser();

  // Conta transações por conta e mês (apenas importadas contam como "extrato").
  const rows = await db
    .select({
      accountId: transaction.accountId,
      month: sql<string>`to_char(${transaction.date}, 'YYYY-MM')`,
      n: sql<number>`count(*)::int`,
    })
    .from(transaction)
    .where(
      and(eq(transaction.userId, user.id), eq(transaction.source, "IMPORT")),
    )
    .groupBy(transaction.accountId, sql`to_char(${transaction.date}, 'YYYY-MM')`);

  // Mapa accountId -> { month -> count }.
  const map = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!map.has(r.accountId)) map.set(r.accountId, new Map());
    map.get(r.accountId)!.set(r.month, r.n);
  }

  // Lista dos últimos N meses (do mais antigo ao atual).
  const months: string[] = [];
  const now = new Date();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(monthKey(d));
  }

  const accounts = await getAccounts();
  return { months, accounts, coverage: map };
}

/** Conta quantas contas recorrentes ativas o usuário tem. */
export async function getRecurringBillCount() {
  const user = await requireUser();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(recurringBill)
    .where(
      and(eq(recurringBill.userId, user.id), eq(recurringBill.active, true)),
    );
  return row?.n ?? 0;
}

/**
 * Previsão de contas fixas do próximo mês: soma e contagem das recorrentes
 * ativas (o que "vai existir" independentemente do mês já gerado ou não).
 */
export async function getRecurringForecast() {
  const user = await requireUser();
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${recurringBill.defaultAmount}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(recurringBill)
    .where(
      and(eq(recurringBill.userId, user.id), eq(recurringBill.active, true)),
    );
  return { total: Number(row?.total ?? 0), count: row?.count ?? 0 };
}

/**
 * Composição da receita do mês: cada fonte ativa com o valor informado para o
 * mês (0 se ainda não preenchido). O somatório é o "esperado a receber".
 */
export async function getIncomeBreakdown(month: string) {
  const user = await requireUser();
  const rows = await db
    .select({
      id: incomeSource.id,
      name: incomeSource.name,
      via: incomeSource.via,
      kind: incomeSource.kind,
      hourlyRate: incomeSource.hourlyRate,
      amount: monthlyIncome.amount,
    })
    .from(incomeSource)
    .leftJoin(
      monthlyIncome,
      and(
        eq(monthlyIncome.incomeSourceId, incomeSource.id),
        eq(monthlyIncome.month, month),
        eq(monthlyIncome.userId, user.id),
      ),
    )
    .where(
      and(eq(incomeSource.userId, user.id), eq(incomeSource.active, true)),
    )
    .orderBy(incomeSource.createdAt);

  const sources = rows.map((r) => ({
    id: r.id,
    name: r.name,
    via: r.via,
    kind: r.kind,
    hourlyRate: r.hourlyRate ? Number(r.hourlyRate) : null,
    amount: Number(r.amount ?? 0),
  }));
  const total = sources.reduce((s, r) => s + r.amount, 0);
  return { sources, total };
}
