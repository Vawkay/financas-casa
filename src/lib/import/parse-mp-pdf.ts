import "server-only";
import PDFParser from "pdf2json";
import type { ParsedTx } from "./types";

function parseBRNumber(s: string): number {
  return Number(s.trim().replace(/\./g, "").replace(",", "."));
}

function toISO(dmy: string): string {
  const [d, m, y] = dmy.split("-");
  return `${y}-${m}-${d}`;
}

/** Extrai o texto do PDF em ordem de leitura (linhas reconstruídas por posição). */
function extractText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();
    parser.on("pdfParser_dataError", (e: Error | { parserError: Error }) =>
      reject(e instanceof Error ? e : e.parserError),
    );
    parser.on("pdfParser_dataReady", (data: PdfData) => {
      const out: string[] = [];
      for (const page of data.Pages ?? []) {
        // Agrupa textos por linha (y arredondado) e ordena por x.
        const byRow = new Map<number, { x: number; t: string }[]>();
        for (const txt of page.Texts ?? []) {
          const key = Math.round(txt.y * 2) / 2;
          const str = decodeURIComponent(txt.R?.[0]?.T ?? "");
          if (!byRow.has(key)) byRow.set(key, []);
          byRow.get(key)!.push({ x: txt.x, t: str });
        }
        const ys = [...byRow.keys()].sort((a, b) => a - b);
        for (const y of ys) {
          const row = byRow
            .get(y)!
            .sort((a, b) => a.x - b.x)
            .map((c) => c.t)
            .join(" ");
          out.push(row);
        }
      }
      resolve(out.join("\n"));
    });
    parser.parseBuffer(buffer);
  });
}

type PdfData = {
  Pages?: { Texts?: { x: number; y: number; R?: { T: string }[] }[] }[];
};

const DATE_RE = /\b(\d{2}-\d{2}-\d{4})\b/g;
// Âncora de uma transação: ID(9+) seguido de "R$ valor" e "R$ saldo".
const TX_RE =
  /(\d{9,})\s+R\$\s*(-?[\d.]+,\d{2})\s+R\$\s*(-?[\d.]+,\d{2})/g;

/**
 * Parser do extrato em PDF do Mercado Pago. Ancora cada transação no padrão
 * "ID R$ valor R$ saldo" e associa a data e a descrição que vêm antes.
 */
export async function parseMercadoPagoPdf(buffer: Buffer): Promise<ParsedTx[]> {
  const text = await extractText(buffer);

  const rows: ParsedTx[] = [];
  let lastDate = "";
  let cursor = 0;

  for (const m of text.matchAll(TX_RE)) {
    const [full, opId, amount] = m;
    const start = m.index ?? 0;
    const between = text.slice(cursor, start);

    // Última data que aparece antes desta transação.
    const dates = [...between.matchAll(DATE_RE)];
    if (dates.length > 0) lastDate = dates[dates.length - 1][1];

    // Descrição = texto entre a última data e o ID, limpo.
    let desc = between;
    if (dates.length > 0) {
      const lastDateMatch = dates[dates.length - 1];
      desc = between.slice((lastDateMatch.index ?? 0) + 10);
    }
    desc = desc.replace(/\s+/g, " ").trim();

    if (lastDate) {
      rows.push({
        date: toISO(lastDate),
        description: desc,
        opId,
        amount: parseBRNumber(amount),
      });
    }
    cursor = start + full.length;
  }

  if (rows.length === 0) {
    throw new Error("Não foi possível extrair transações do PDF do Mercado Pago.");
  }
  return rows;
}
