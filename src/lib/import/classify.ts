import type { ParsedTx, ClassifiedTx, TxKind, TxHint } from "./types";

/** Remove acentos e baixa caixa para casar padrões com robustez. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

type Rule = {
  name: string;
  /** Casa pela descrição normalizada e (opcional) sinal do valor. */
  test: (desc: string, amount: number) => boolean;
  kind: TxKind;
  category: string | null;
  hint: TxHint;
  /** Nome da conta-destino sugerida (para transferências). */
  account?: string;
  confidence: "high" | "medium" | "low";
};

const has =
  (...subs: string[]) =>
  (desc: string) =>
    subs.some((s) => desc.includes(s));

/**
 * Regras ordenadas (a primeira que casar vence). Derivadas da análise do
 * extrato real do Mercado Pago — ver memória [[extrato-mercado-pago]].
 */
const RULES: Rule[] = [
  // --- Transferências (NÃO são gasto nem receita) ---
  {
    name: "cofrinho",
    test: has("reserva por gastos", "dinheiro reservado", "dinheiro retirado"),
    kind: "TRANSFER",
    category: null,
    hint: "cofrinho",
    confidence: "high",
  },
  {
    name: "pagamento_cartao",
    test: (d) => d.includes("pagamento cartao de credito"),
    kind: "TRANSFER",
    category: null,
    hint: "cartao",
    account: "Cartão Mercado Pago",
    confidence: "high",
  },
  {
    name: "cartao_santander",
    test: (d, a) => d.includes("banco santander") && a < 0 && Math.abs(a) > 100,
    kind: "TRANSFER",
    category: null,
    hint: "cartao",
    account: "Cartão Santander",
    confidence: "medium",
  },
  {
    // Linha de crédito da Shopee (fatura da esposa) — pagamento = transferência.
    name: "linha_shopee",
    test: (d, a) => a < 0 && has("shpp", "shopee")(d),
    kind: "TRANSFER",
    category: null,
    hint: "cartao",
    account: "Shopee",
    confidence: "high",
  },
  // --- Empréstimos (entrada = transferência da dívida p/ conta) ---
  {
    name: "emprestimo_entrada",
    test: (d, a) =>
      a > 0 &&
      has(
        "deposito do emprestimo",
        "aprovacao do credito",
        "linha de credito",
        "credito em parcelas",
      )(d),
    kind: "TRANSFER",
    category: null,
    hint: "emprestimo_entrada",
    account: "Linha de Crédito Mercado Pago",
    confidence: "high",
  },
  // --- Pagamentos de dívida (abate Falta) ---
  {
    name: "divida_mrv_opea",
    test: (d, a) =>
      a < 0 && has("mrv", "opea securitizadora")(d),
    kind: "TRANSFER",
    category: null,
    hint: "divida_pagamento",
    confidence: "medium",
  },
  {
    name: "divida_emprestimo_mp",
    test: (d, a) => a < 0 && d.includes("parcela emprestimos mercado pago"),
    kind: "TRANSFER",
    category: null,
    hint: "divida_pagamento",
    confidence: "high",
  },
  {
    name: "divida_financiamento_pan",
    test: (d, a) => a < 0 && has("auto pan", "banco pan")(d),
    kind: "TRANSFER",
    category: null,
    hint: "divida_pagamento",
    confidence: "high",
  },
  {
    // Aporte em fundo de investimento — saída da conta p/ reserva.
    name: "investimento_fundo",
    test: (d) => has("fundo de investimento", "investimento fundo")(d),
    kind: "TRANSFER",
    category: "Investimento",
    hint: "cofrinho",
    confidence: "high",
  },
  // --- Receitas ---
  {
    name: "renda_pj",
    test: (d, a) =>
      a > 0 &&
      d.includes("pix recebido") &&
      has("desenvolvimento de software", "felipe r da silva")(d),
    kind: "INCOME",
    category: null,
    hint: "renda_pj",
    confidence: "high",
  },
  {
    name: "rendimentos",
    test: (d, a) => a > 0 && d.includes("rendimentos"),
    kind: "INCOME",
    category: "Investimento",
    hint: "rendimento",
    confidence: "high",
  },
  // --- Contas fixas ---
  { name: "aluguel", test: has("imobiliaria"), kind: "EXPENSE", category: "Aluguel", hint: null, confidence: "high" },
  { name: "energia", test: has("copel"), kind: "EXPENSE", category: "Energia (Copel)", hint: null, confidence: "high" },
  { name: "agua", test: has("sanepar", "saneamento do parana"), kind: "EXPENSE", category: "Água (Sanepar)", hint: null, confidence: "high" },
  { name: "internet", test: has("persis internet", "internet ltda"), kind: "EXPENSE", category: "Internet", hint: null, confidence: "high" },
  { name: "telefonia", test: has("tim s a", "tim s/a"), kind: "EXPENSE", category: "Telefonia", hint: null, confidence: "high" },
  { name: "inss", test: has("previdencia social", "inss", "(gps)"), kind: "EXPENSE", category: "Impostos", hint: null, confidence: "medium" },
  { name: "impostos", test: has("receita federal"), kind: "EXPENSE", category: "Impostos", hint: null, confidence: "high" },
  { name: "contabilidade", test: has("contabilizei"), kind: "EXPENSE", category: "Contabilidade", hint: null, confidence: "high" },
  // --- Gasto variável ---
  { name: "mercado", test: has("atacadao", "supermercado", "angeloni", "tonhao", "oba oba", "lumillar", "j v correia"), kind: "EXPENSE", category: "Mercado", hint: null, confidence: "medium" },
  { name: "roupas", test: has("torra torra", "renner", "riachuelo", "boticario"), kind: "EXPENSE", category: "Roupas", hint: null, confidence: "medium" },
  { name: "mercado_livre", test: has("mercado livre"), kind: "EXPENSE", category: "Outros", hint: null, confidence: "low" },
  { name: "outfood", test: has("burger king", "ifood", "pastel", "pao quente", "padaria", "mg gas"), kind: "EXPENSE", category: "OutFood", hint: null, confidence: "medium" },
  { name: "transporte", test: has("transportes*bus", "sem parar", "transportes bus"), kind: "EXPENSE", category: "Transporte", hint: null, confidence: "high" },
  { name: "assinaturas", test: has("google brasil pagamentos"), kind: "EXPENSE", category: "Assinaturas", hint: null, confidence: "medium" },
];

/** Classifica uma transação. Sem regra → palpite pelo sinal, baixa confiança. */
export function classify(tx: ParsedTx): ClassifiedTx {
  const desc = norm(tx.description);
  const rule = RULES.find((r) => r.test(desc, tx.amount));

  if (rule) {
    return {
      ...tx,
      kind: rule.kind,
      category: rule.category,
      hint: rule.hint,
      suggestedAccount: rule.account ?? null,
      ruleName: rule.name,
      confidence: rule.confidence,
    };
  }

  return {
    ...tx,
    kind: tx.amount >= 0 ? "INCOME" : "EXPENSE",
    category: null,
    hint: null,
    suggestedAccount: null,
    ruleName: "fallback",
    confidence: "low",
  };
}

export function classifyAll(txs: ParsedTx[]): ClassifiedTx[] {
  return txs.map(classify);
}
