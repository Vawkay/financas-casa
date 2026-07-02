import type { ParsedTx } from "./types";

/** "-1.292,20" → -1292.2 (formato BR: ponto milhar, vírgula decimal). */
function parseBRNumber(s: string): number {
  return Number(s.trim().replace(/\./g, "").replace(",", "."));
}

/** "01-06-2026" → "2026-06-01". */
function parseDate(s: string): string {
  const [d, m, y] = s.trim().split("-");
  return `${y}-${m}-${d}`;
}

/**
 * Parser do extrato CSV do Mercado Pago (delimitado por ';').
 * Estrutura: bloco de saldos, linha em branco, cabeçalho
 * RELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE
 * e as transações. Robusto a ';' na descrição (data = 1º campo; saldo/valor/id
 * são os 3 últimos; descrição = o que sobra no meio).
 */
export function parseMercadoPagoCsv(text: string): ParsedTx[] {
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => l.startsWith("RELEASE_DATE"));
  if (headerIdx === -1) {
    throw new Error("Arquivo não parece um extrato CSV do Mercado Pago.");
  }

  const rows: ParsedTx[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(";");
    if (parts.length < 5) continue;

    const balance = parts[parts.length - 1];
    const amount = parts[parts.length - 2];
    const opId = parts[parts.length - 3];
    const description = parts.slice(1, parts.length - 3).join(";").trim();

    rows.push({
      date: parseDate(parts[0]),
      description,
      opId: opId.trim(),
      amount: parseBRNumber(amount),
      balance: parseBRNumber(balance),
    });
  }
  return rows;
}
