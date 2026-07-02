import "server-only";
import type { ParsedTx } from "./types";

/**
 * Extrai as compras de uma fatura de cartão (texto bruto) usando o Gemini.
 * Lida com layouts variados (MP, Santander, Pan). Retorna ParsedTx com as
 * COMPRAS (despesas, valor negativo); ignora pagamentos de fatura e totais.
 */

type InvoiceItem = {
  date: string; // DD/MM
  description: string;
  amount: number; // positivo no documento
  installment?: string | null;
  cardholder?: string | null;
  isPayment?: boolean;
};

const SYSTEM = `Você extrai os lançamentos de uma fatura de cartão de crédito brasileira (texto OCR/PDF, pode estar com espaçamento irregular).
Regras:
- Extraia APENAS compras/despesas e parcelamentos (lançamentos de consumo).
- Marque isPayment=true em linhas de "Pagamento de fatura", estornos, créditos e ajustes (não são compras).
- IGNORE totais, subtotais, resumos, limites, juros, textos explicativos e cabeçalhos.
- date no formato DD/MM exatamente como no documento.
- amount é o valor em reais (número positivo). Use ponto decimal.
- installment como "X/Y" ou "X de Y" se houver, senão null.
- cardholder = nome do portador do cartão se a fatura separar por portador, senão null.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    dueDate: { type: "STRING", description: "Data de vencimento DD/MM/AAAA se houver" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING" },
          description: { type: "STRING" },
          amount: { type: "NUMBER" },
          installment: { type: "STRING", nullable: true },
          cardholder: { type: "STRING", nullable: true },
          isPayment: { type: "BOOLEAN" },
        },
        required: ["date", "description", "amount", "isPayment"],
      },
    },
  },
  required: ["items"],
};

/** Resolve "DD/MM" para "YYYY-MM-DD" inferindo o ano pela data de vencimento. */
function resolveYear(ddmm: string, dueYear: number, dueMonth: number): string {
  const [d, m] = ddmm.split("/").map(Number);
  if (!d || !m) return "";
  // Compra costuma ser até ~2 meses antes do vencimento: se o mês da compra
  // é maior que o do vencimento, é do ano anterior (virada de ano).
  const year = m > dueMonth + 1 ? dueYear - 1 : dueYear;
  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export async function extractInvoiceWithGemini(
  text: string,
  fallbackDueDate: Date = new Date(),
): Promise<ParsedTx[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Configure GEMINI_API_KEY para importar faturas.");

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: text.slice(0, 60000) }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Gemini não retornou dados da fatura.");

  const parsed = JSON.parse(raw) as { dueDate?: string; items: InvoiceItem[] };

  let dueYear = fallbackDueDate.getFullYear();
  let dueMonth = fallbackDueDate.getMonth() + 1;
  if (parsed.dueDate) {
    const m = parsed.dueDate.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) {
      dueMonth = Number(m[2]);
      dueYear = Number(m[3]);
    }
  }

  const rows: ParsedTx[] = [];
  const seen = new Map<string, number>();
  for (const it of parsed.items) {
    if (it.isPayment) continue;
    const iso = resolveYear(it.date, dueYear, dueMonth);
    if (!iso || !it.amount) continue;

    const desc =
      (it.installment ? `${it.description} (${it.installment})` : it.description) +
      (it.cardholder ? ` · ${it.cardholder}` : "");

    // Hash determinístico para dedup (faturas não têm ID de operação).
    const base = `${iso}|${it.amount}|${it.description}`;
    const seq = (seen.get(base) ?? 0) + 1;
    seen.set(base, seq);

    rows.push({
      date: iso,
      description: desc.trim(),
      opId: `inv:${base}#${seq}`,
      amount: -Math.abs(it.amount), // compra = despesa
    });
  }
  return rows;
}
