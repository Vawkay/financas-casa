import { parseMercadoPagoCsv } from "./parse-mp-csv";
import { parseMercadoPagoPdf } from "./parse-mp-pdf";
import type { ParsedTx } from "./types";

export type StatementFormat = "CSV" | "PDF";

export function detectFormat(fileName: string): StatementFormat {
  return fileName.toLowerCase().endsWith(".pdf") ? "PDF" : "CSV";
}

/** Roteia para o parser certo conforme o formato do arquivo. */
export async function parseStatement(
  buffer: Buffer,
  fileName: string,
): Promise<{ format: StatementFormat; txs: ParsedTx[] }> {
  const format = detectFormat(fileName);
  if (format === "PDF") {
    return { format, txs: await parseMercadoPagoPdf(buffer) };
  }
  // CSV do Mercado Pago é UTF-8.
  return { format, txs: parseMercadoPagoCsv(buffer.toString("utf8")) };
}
