/** Normaliza texto: sem acentos, minúsculas, espaços colapsados. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const PREFIXES =
  /^(pagamento de conta|pagamento com qr pix|pagamento de parcela|pagamento|pix enviado|pix recebido|deposito do|reserva por gastos|dinheiro reservado|dinheiro retirado|com qr pix|aprovacao do credito)\s+/;

const TRAIL = /\b(ltda|s\/?a|s a|me|epp|eireli|inc)\b/g;

/**
 * Deriva uma "chave" estável do estabelecimento/pessoa a partir da descrição,
 * para o motor de aprendizado reconhecer o mesmo lançamento no futuro.
 * Ex: "Pagamento com QR Pix IRMAOS MICHELATO LTDA" -> "irmaos michelato".
 */
export function merchantKey(description: string): string {
  let s = normalize(description);
  // Remove sufixos de fatura: portador (após "·") e marcação de parcela —
  // o apelido é da LOJA, não do portador/parcela.
  s = s.split("·")[0];
  s = s
    .replace(/\([^)]*\)/g, " ")
    .replace(/parcela\s+\d+\s+de\s+\d+/g, " ");
  // Remove ruídos de prefixo (pode haver mais de um encadeado).
  for (let i = 0; i < 3; i++) {
    const next = s.replace(PREFIXES, "");
    if (next === s) break;
    s = next;
  }
  s = s
    .replace(TRAIL, "")
    .replace(/[0-9]+/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = s.split(" ").filter((w) => w.length > 1);
  return words.slice(0, 3).join(" ").trim();
}
