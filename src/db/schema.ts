import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  date,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const accountType = pgEnum("account_type", [
  "CHECKING", // conta corrente / carteira digital (Mercado Pago, Wise, PicPay Empresas)
  "CREDIT_CARD", // cartão de crédito (passivo)
  "LOAN", // empréstimo / linha de crédito (passivo)
  "SAVINGS", // cofrinhos / reservas
]);

export const transactionType = pgEnum("transaction_type", [
  "INCOME", // entrada de dinheiro
  "EXPENSE", // saída de dinheiro (gasto real)
  "TRANSFER", // movimento entre contas (pagamento de fatura, mover p/ MP) — NÃO é gasto
]);

export const transactionStatus = pgEnum("transaction_status", [
  "PENDING", // importada, aguardando revisão/confirmação
  "CONFIRMED",
]);

export const transactionSource = pgEnum("transaction_source", [
  "MANUAL",
  "IMPORT",
]);

export const billStatus = pgEnum("bill_status", [
  "A_PAGAR",
  "RESERVADO",
  "PAGO",
]);

export const debtDirection = pgEnum("debt_direction", [
  "TAKEN", // dívida que eu devo (empréstimo tomado, acordo, renegociação)
  "GIVEN", // empréstimo que eu fiz a alguém
]);

export const importFormat = pgEnum("import_format", [
  "CSV",
  "XLSX",
  "OFX",
  "PDF",
]);

export const importStatus = pgEnum("import_status", [
  "UPLOADED",
  "PARSED",
  "REVIEWED",
  "IMPORTED",
  "FAILED",
]);

export const ruleMatchType = pgEnum("rule_match_type", ["KEYWORD", "REGEX"]);

/* ------------------------------------------------------------------ */
/* Helpers de coluna                                                  */
/* ------------------------------------------------------------------ */

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
// userId referencia auth.users do Supabase; RLS garante isolamento (ver db/rls.sql).
const userId = () => uuid("user_id").notNull();
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

/* ------------------------------------------------------------------ */
/* Tabelas                                                            */
/* ------------------------------------------------------------------ */

export const account = pgTable(
  "account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    name: text("name").notNull(),
    type: accountType("type").notNull(),
    institution: text("institution"), // "Mercado Pago", "Wise", "Nubank"...
    currentBalance: money("current_balance").notNull().default("0"),
    creditLimit: money("credit_limit"), // só p/ CREDIT_CARD / LOAN
    closingDay: integer("closing_day"), // dia de fechamento da fatura
    dueDay: integer("due_day"), // dia de vencimento da fatura
    // Senha do PDF da fatura (cartões). Derivada do CPF; guardada p/ desbloqueio
    // automático na importação. App de usuário único + RLS — sem dado de terceiros.
    statementPassword: text("statement_password"),
    archived: boolean("archived").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const category = pgTable(
  "category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    name: text("name").notNull(),
    parentId: uuid("parent_id"), // agrupamento opcional (self-ref)
    color: text("color"),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("category_user_idx").on(t.userId)],
);

export const transaction = pgTable(
  "transaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    date: date("date").notNull(),
    amount: money("amount").notNull(), // magnitude positiva; o "type" define o sinal
    type: transactionType("type").notNull(),
    // Conta principal afetada. Em TRANSFER é a origem; counterAccountId é o destino.
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "restrict" }),
    counterAccountId: uuid("counter_account_id").references(() => account.id, {
      onDelete: "set null",
    }),
    categoryId: uuid("category_id").references(() => category.id, {
      onDelete: "set null",
    }),
    debtId: uuid("debt_id"), // se a transação abate/origina uma dívida
    description: text("description").notNull().default(""),
    rawDescription: text("raw_description"), // texto original do extrato
    status: transactionStatus("status").notNull().default("CONFIRMED"),
    source: transactionSource("source").notNull().default("MANUAL"),
    importBatchId: uuid("import_batch_id"),
    dedupHash: text("dedup_hash"), // hash p/ dedup em CSV/XLSX
    fitid: text("fitid"), // identificador único do OFX
    createdAt: createdAt(),
  },
  (t) => [
    index("transaction_user_date_idx").on(t.userId, t.date),
    index("transaction_account_idx").on(t.accountId),
    uniqueIndex("transaction_dedup_idx").on(t.userId, t.accountId, t.dedupHash),
  ],
);

export const recurringBill = pgTable(
  "recurring_bill",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    name: text("name").notNull(),
    defaultAmount: money("default_amount").notNull().default("0"),
    dueDay: integer("due_day"),
    installmentTotal: integer("installment_total"), // p/ contas parceladas longas
    categoryId: uuid("category_id").references(() => category.id, {
      onDelete: "set null",
    }),
    accountId: uuid("account_id").references(() => account.id, {
      onDelete: "set null",
    }),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("recurring_bill_user_idx").on(t.userId)],
);

export const monthlyBillStatus = pgTable(
  "monthly_bill_status",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    month: varchar("month", { length: 7 }).notNull(), // YYYY-MM
    recurringBillId: uuid("recurring_bill_id").references(
      () => recurringBill.id,
      { onDelete: "set null" },
    ),
    name: text("name").notNull(),
    amount: money("amount").notNull(),
    dueDay: integer("due_day"),
    status: billStatus("status").notNull().default("A_PAGAR"),
    installmentNo: integer("installment_no"), // parcela atual (ex.: 3)
    installmentTotal: integer("installment_total"), // total de parcelas (ex.: 10)
    categoryId: uuid("category_id").references(() => category.id, {
      onDelete: "set null",
    }),
    paidTransactionId: uuid("paid_transaction_id").references(
      () => transaction.id,
      { onDelete: "set null" },
    ),
    createdAt: createdAt(),
  },
  (t) => [
    index("mbs_user_month_idx").on(t.userId, t.month),
    uniqueIndex("mbs_unique_idx").on(t.userId, t.month, t.recurringBillId),
  ],
);

export const debt = pgTable(
  "debt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    name: text("name").notNull(),
    direction: debtDirection("direction").notNull().default("TAKEN"),
    principalTotal: money("principal_total").notNull(),
    amountPaid: money("amount_paid").notNull().default("0"),
    installments: integer("installments"),
    counterpartyName: text("counterparty_name"), // credor/devedor
    accountId: uuid("account_id").references(() => account.id, {
      onDelete: "set null",
    }),
    startDate: date("start_date"),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("debt_user_idx").on(t.userId)],
);

export const incomeSource = pgTable(
  "income_source",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    name: text("name").notNull(), // "ABI", "Klarz", "Katia"
    via: text("via"), // "Wise", "PicPay Empresas"
    kind: text("kind").notNull().default("OTHER"), // SALARY | PJ_HOURLY | OTHER
    hourlyRate: money("hourly_rate"),
    expectedMonthly: money("expected_monthly"),
    accountId: uuid("account_id").references(() => account.id, {
      onDelete: "set null",
    }),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("income_source_user_idx").on(t.userId)],
);

/** Valor recebido/esperado de cada fonte num mês (compõe o "saldo possível"). */
export const monthlyIncome = pgTable(
  "monthly_income",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    month: varchar("month", { length: 7 }).notNull(), // YYYY-MM
    incomeSourceId: uuid("income_source_id")
      .notNull()
      .references(() => incomeSource.id, { onDelete: "cascade" }),
    amount: money("amount").notNull().default("0"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("monthly_income_unique_idx").on(
      t.userId,
      t.month,
      t.incomeSourceId,
    ),
  ],
);

export const importBatch = pgTable(
  "import_batch",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),
    format: importFormat("format").notNull(),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    fileUrl: text("file_url"),
    fileName: text("file_name"),
    status: importStatus("status").notNull().default("UPLOADED"),
    rowCount: integer("row_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("import_batch_user_idx").on(t.userId)],
);

export const categorizationRule = pgTable(
  "categorization_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    matchType: ruleMatchType("match_type").notNull().default("KEYWORD"),
    pattern: text("pattern").notNull(),
    displayName: text("display_name"), // apelido que o usuário deu ao estabelecimento
    minAmount: money("min_amount"),
    maxAmount: money("max_amount"),
    sign: varchar("sign", { length: 1 }), // '+' entrada | '-' saída
    categoryId: uuid("category_id").references(() => category.id, {
      onDelete: "set null",
    }),
    transactionType: transactionType("transaction_type"),
    counterAccountId: uuid("counter_account_id").references(() => account.id, {
      onDelete: "set null",
    }),
    debtId: uuid("debt_id").references(() => debt.id, { onDelete: "set null" }),
    priority: integer("priority").notNull().default(100),
    active: boolean("active").notNull().default(true),
    hitCount: integer("hit_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("rule_user_priority_idx").on(t.userId, t.priority)],
);

/* ------------------------------------------------------------------ */
/* Tipos inferidos                                                    */
/* ------------------------------------------------------------------ */

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Category = typeof category.$inferSelect;
export type Transaction = typeof transaction.$inferSelect;
export type NewTransaction = typeof transaction.$inferInsert;
export type RecurringBill = typeof recurringBill.$inferSelect;
export type MonthlyBillStatus = typeof monthlyBillStatus.$inferSelect;
export type Debt = typeof debt.$inferSelect;
export type IncomeSource = typeof incomeSource.$inferSelect;
export type MonthlyIncome = typeof monthlyIncome.$inferSelect;
export type ImportBatch = typeof importBatch.$inferSelect;
export type CategorizationRule = typeof categorizationRule.$inferSelect;
