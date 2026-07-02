import "server-only";
import type { ClassifiedTx, TxKind } from "./types";

/**
 * Sugere categoria/tipo para transações de baixa confiança usando o Gemini.
 * Envia apenas descrição + valor (sem CPF/conta/IDs) e somente as linhas que
 * as regras não resolveram. Sem GEMINI_API_KEY, retorna as transações intactas.
 */

type Suggestion = { index: number; kind: TxKind; category: string | null };

const SYSTEM = `Você classifica transações de um extrato bancário brasileiro de finanças pessoais.
Para cada transação retorne:
- kind: "INCOME" (entrada/receita), "EXPENSE" (gasto real) ou "TRANSFER" (movimento entre contas próprias, pagamento de fatura, empréstimo — NÃO é gasto nem receita).
- category: o nome de UMA das categorias fornecidas, ou null se for TRANSFER ou não houver categoria adequada.
Pix enviado a pessoas físicas geralmente é EXPENSE sem categoria clara (use "Outros"). Seja conservador.`;

export async function suggestWithGemini(
  txs: ClassifiedTx[],
  categories: string[],
): Promise<ClassifiedTx[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return txs;

  // Só manda para a IA o que ficou de baixa confiança.
  const targets = txs
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.confidence === "low");
  if (targets.length === 0) return txs;

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const items = targets.map(({ t }, idx) => ({
    index: idx,
    description: t.description,
    amount: t.amount,
  }));

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              `Categorias disponíveis: ${categories.join(", ")}.\n\n` +
              `Transações (index, descrição, valor):\n${JSON.stringify(items)}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            index: { type: "INTEGER" },
            kind: { type: "STRING", enum: ["INCOME", "EXPENSE", "TRANSFER"] },
            category: { type: "STRING", nullable: true },
          },
          required: ["index", "kind"],
        },
      },
    },
  };

  let suggestions: Suggestion[] = [];
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("[gemini] HTTP", res.status, await res.text());
      return txs;
    }
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return txs;
    suggestions = JSON.parse(text);
  } catch (e) {
    console.error("[gemini] falha:", (e as Error).message);
    return txs;
  }

  const validCats = new Set(categories);
  const out = [...txs];
  for (const s of suggestions) {
    const target = targets[s.index];
    if (!target) continue;
    const cat =
      s.category && validCats.has(s.category) ? s.category : null;
    out[target.i] = {
      ...out[target.i],
      kind: s.kind,
      category: s.kind === "TRANSFER" ? null : cat,
      ruleName: "gemini",
      confidence: "medium",
    };
  }
  return out;
}
