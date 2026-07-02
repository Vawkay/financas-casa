import "server-only";

/**
 * Extrai o texto de um PDF (inclusive protegido por senha) usando pdfjs-dist.
 * Reconstrói as linhas por posição vertical para preservar a leitura.
 */
export async function extractPdfText(
  buffer: Buffer,
  password?: string,
): Promise<string> {
  // Import dinâmico do build legacy (compatível com Node/serverless).
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({
    data,
    password: password || undefined,
    useSystemFonts: true,
  }).promise;

  const out: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();

    // Agrupa itens por linha (y arredondado) e ordena por x.
    const byRow = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items) {
      const it = item as { str?: string; transform?: number[] };
      if (typeof it.str !== "string" || !it.transform) continue;
      const x = it.transform[4];
      const y = Math.round(it.transform[5]);
      if (!byRow.has(y)) byRow.set(y, []);
      byRow.get(y)!.push({ x, s: it.str });
    }
    const ys = [...byRow.keys()].sort((a, b) => b - a); // topo → base
    for (const y of ys) {
      const line = byRow
        .get(y)!
        .sort((a, b) => a.x - b.x)
        .map((c) => c.s)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (line) out.push(line);
    }
  }
  return out.join("\n");
}

/** Erro específico para senha incorreta/ausente em PDF protegido. */
export function isPasswordError(e: unknown): boolean {
  const name = (e as { name?: string })?.name ?? "";
  return name === "PasswordException";
}
