/** Tipos do pipeline de importação de extrato. */

export type TxKind = "INCOME" | "EXPENSE" | "TRANSFER";

/** Linha crua já normalizada a partir do arquivo (CSV/XLSX/OFX/PDF). */
export type ParsedTx = {
  date: string; // YYYY-MM-DD
  description: string;
  opId: string; // "ID da operação" do Mercado Pago — chave de dedup
  amount: number; // valor com sinal (+ entrada / − saída)
  balance?: number;
};

/** Dica de destino especial da transação (orienta o vínculo na revisão). */
export type TxHint =
  | "cofrinho" // reserva/resgate em cofrinho → transferência
  | "cartao" // pagamento de fatura → transferência p/ cartão
  | "emprestimo_entrada" // dinheiro de empréstimo caiu na conta
  | "divida_pagamento" // pagamento de parcela/acordo → abate dívida
  | "renda_pj" // recebimento da PJ
  | "rendimento"
  | null;

export type ClassifiedTx = ParsedTx & {
  kind: TxKind;
  category: string | null; // nome da categoria (mapeado p/ id na revisão)
  hint: TxHint;
  suggestedAccount: string | null; // nome da conta-destino sugerida (transferências)
  ruleName: string;
  confidence: "high" | "medium" | "low";
};
