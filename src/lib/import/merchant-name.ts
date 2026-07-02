/**
 * Embeleza o nome de um estabelecimento vindo de fatura/extrato.
 *
 * Faturas de cartão raramente trazem a loja: trazem o intermediário de
 * pagamento (gateway) com o nome do vendedor truncado e em CAIXA ALTA. Aqui:
 *  - reconhecemos o gateway (IFD*, MP*, DL*, ZP*, MERCADOLIVRE*…) → "via X";
 *  - limpamos códigos numéricos do gateway;
 *  - separamos camelCase ("UberRides" → "Uber Rides");
 *  - normalizamos marcas conhecidas (SEMPARAR → "Sem Parar");
 *  - extraímos um CNPJ quando presente (p/ consulta posterior na RFB).
 */

export type MerchantInfo = {
  /** Nome amigável para exibir. */
  display: string;
  /** Intermediário de pagamento reconhecido (iFood, Mercado Pago…), ou null. */
  via: string | null;
  /** CNPJ completo (14 dígitos) quando derivável do texto, ou null. */
  cnpj: string | null;
};

/** Gateways/maquininhas: prefixo → nome do intermediário. */
const GATEWAYS: { re: RegExp; via: string }[] = [
  { re: /^ifd\s*\*\s*/i, via: "iFood" },
  { re: /^ifood\s*\*?\s*/i, via: "iFood" },
  { re: /^mercado\s*livre\s*\*\s*/i, via: "Mercado Livre" },
  { re: /^mp\s*\*\s*/i, via: "Mercado Pago" },
  { re: /^dl\s*\*\s*/i, via: "dLocal" },
  { re: /^zp\s*\*\s*/i, via: "Zoop" },
  { re: /^pag\s*\*\s*/i, via: "PagSeguro" },
  { re: /^pg\s*\*\s*/i, via: "PagSeguro" },
  { re: /^paypal\s*\*?\s*/i, via: "PayPal" },
  { re: /^ec\s*\*\s*/i, via: "" },
  { re: /^pic\s*\*\s*/i, via: "PicPay" },
];

/** Marcas conhecidas: se o texto normalizado contém a chave, vira o valor. */
const BRANDS: { keys: string[]; name: string }[] = [
  { keys: ["semparar", "sem parar"], name: "Sem Parar" },
  { keys: ["uberrides", "uber rides", "uber pending", "uber"], name: "Uber" },
  { keys: ["mercadolivre", "mercado livre", "melimais", "meli mais", "meli+"], name: "Mercado Livre" },
  { keys: ["youtub", "youtube", "google"], name: "Google" },
  { keys: ["microsoft", "microsoft 365"], name: "Microsoft" },
  { keys: ["steam"], name: "Steam" },
  { keys: ["totalpass"], name: "TotalPass" },
  { keys: ["cobasi"], name: "Cobasi" },
  { keys: ["super golff"], name: "Super Golff" },
  { keys: ["angeloni"], name: "Angeloni" },
  { keys: ["amigao"], name: "Amigão" },
  { keys: ["oba oba"], name: "Oba Oba" },
  { keys: ["pao quente"], name: "Padaria Pão Quente" },
  { keys: ["torra torra"], name: "Torra Torra" },
  { keys: ["prudential"], name: "Prudential (seguro)" },
  { keys: ["loovi"], name: "Loovi (seguro/rastreador)" },
  { keys: ["shopee", "shpp"], name: "Shopee" },
  { keys: ["hardtek"], name: "Hardtek Computadores" },
];

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** "UberRides" → "Uber Rides"; "AutoPosto" → "Auto Posto". */
function splitCamel(s: string): string {
  return s
    .replace(/([a-zà-ú])([A-ZÀ-Ú])/g, "$1 $2")
    .replace(/([A-ZÀ-Ú]{2,})([A-ZÀ-Ú][a-zà-ú])/g, "$1 $2");
}

/** Title Case preservando palavras já mistas; mantém siglas curtas. */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length <= 1 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ")
    .trim();
}

/** Calcula os 2 dígitos verificadores e devolve o CNPJ completo a partir da raiz. */
function cnpjFromRoot(root8: string): string | null {
  if (!/^\d{8}$/.test(root8)) return null;
  const base = root8 + "0001"; // assume matriz
  const dv = (nums: string): number => {
    const w = nums.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = nums.split("").reduce((a, d, i) => a + Number(d) * w[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base);
  const d2 = dv(base + d1);
  return `${root8}0001${d1}${d2}`;
}

/** Extrai um CNPJ (raiz de 8 dígitos, formatada ou não) do texto. */
function extractCnpj(raw: string): string | null {
  // Ex.: "59.255.066 RAFAELA KIA" ou "59255066000130"
  const full = raw.match(/\b(\d{2})\.?(\d{3})\.?(\d{3})\/?(\d{4})-?(\d{2})\b/);
  if (full) return full.slice(1).join("");
  const root = raw.match(/\b(\d{2})\.(\d{3})\.(\d{3})\b/);
  if (root) return cnpjFromRoot(root.slice(1).join(""));
  return null;
}

export function prettyMerchant(raw: string): MerchantInfo {
  const original = raw.trim();
  const cnpj = extractCnpj(original);

  // Separa sufixos que queremos preservar: "(1 de 3)" e "· Portador".
  let head = original;
  let suffix = "";
  const tail = head.match(/\s*(\([^)]*\)|·\s*.+|parcela\s+\d+\s+de\s+\d+)\s*$/i);
  if (tail) {
    // Preserva tudo a partir do primeiro marcador de parcela/portador.
    const idx = head.search(/\s*(\(|·|parcela\s+\d+\s+de\s+\d+)/i);
    if (idx > 0) {
      suffix = " " + head.slice(idx).trim();
      head = head.slice(0, idx).trim();
    }
  }

  // Detecta gateway no início.
  let via: string | null = null;
  for (const g of GATEWAYS) {
    if (g.re.test(head)) {
      via = g.via || null;
      head = head.replace(g.re, "").trim();
      break;
    }
  }

  // Remove ID numérico do gateway grudado no nome (ex.: "61561249VALQU").
  head = head.replace(/^\d{4,}\s*/, "").replace(/^\d{4,}(?=[A-Za-z])/, "");
  // Remove CNPJ/raiz solta do começo ("59.255.066 RAFAELA KIA" → "RAFAELA KIA").
  head = head.replace(/^\d{2}\.?\d{3}\.?\d{3}(\/?\d{4}-?\d{2})?\s+/, "");
  // Remove ID numérico solto no fim ("CLEBERSO 56927" → "CLEBERSO").
  head = head.replace(/\s+\d{3,}$/, "").trim();

  const normHead = stripAccents(head).toLowerCase();

  // Marca conhecida?
  let display = "";
  for (const b of BRANDS) {
    if (b.keys.some((k) => normHead.includes(stripAccents(k)))) {
      display = b.name;
      break;
    }
  }

  if (!display) {
    // CAIXA ALTA (típico de fatura) → Title Case; texto já formatado fica como está.
    const shouty = head === head.toUpperCase() && /[A-ZÀ-Ú]/.test(head);
    display = (shouty ? titleCase(splitCamel(head)) : splitCamel(head)).trim();
  }

  // Se sobrou vazio (ex.: "IFD*BR" → "BR" sem sentido), usa o gateway.
  if (!display || /^(br|brasil)$/i.test(display)) {
    display = via ?? original;
  }

  return { display: (display + suffix).trim(), via, cnpj };
}
