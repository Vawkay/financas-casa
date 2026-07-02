import {
  Home,
  Zap,
  Droplet,
  Wifi,
  Smartphone,
  HeartPulse,
  Landmark,
  Calculator,
  ShieldCheck,
  CreditCard,
  Car,
  Glasses,
  ShoppingCart,
  Pill,
  Dumbbell,
  Tv,
  Gamepad2,
  Music,
  Package,
  HandCoins,
  Receipt,
  type LucideIcon,
} from "lucide-react";

/**
 * Mapeia o nome de uma conta para um ícone significativo + cor.
 * As classes são literais (JIT do Tailwind precisa enxergá-las no código).
 */
const RULES: { test: RegExp; icon: LucideIcon; cls: string }[] = [
  { test: /aluguel|moradia|condominio/, icon: Home, cls: "text-amber-400 bg-amber-400/10" },
  { test: /copel|energia|\bluz\b|eletric/, icon: Zap, cls: "text-yellow-400 bg-yellow-400/10" },
  { test: /sanepar|agua|saneamento|esgoto/, icon: Droplet, cls: "text-sky-400 bg-sky-400/10" },
  { test: /internet|wifi|fibra|banda larga/, icon: Wifi, cls: "text-indigo-400 bg-indigo-400/10" },
  { test: /\btim\b|vivo|claro|oi |telefon|celular/, icon: Smartphone, cls: "text-blue-400 bg-blue-400/10" },
  { test: /saude|plano|unimed|odonto|hapvida|amil/, icon: HeartPulse, cls: "text-rose-400 bg-rose-400/10" },
  { test: /imposto|\bdas\b|tribut|inss|previd|guia/, icon: Landmark, cls: "text-stone-300 bg-stone-400/10" },
  { test: /contabil/, icon: Calculator, cls: "text-teal-400 bg-teal-400/10" },
  { test: /seguro/, icon: ShieldCheck, cls: "text-emerald-400 bg-emerald-400/10" },
  { test: /cart[aã]o/, icon: CreditCard, cls: "text-purple-400 bg-purple-400/10" },
  { test: /carro|ve[ií]culo|\bauto\b|moto|parcela carro/, icon: Car, cls: "text-cyan-400 bg-cyan-400/10" },
  { test: /[óo]culos|[óo]tica|lente/, icon: Glasses, cls: "text-fuchsia-400 bg-fuchsia-400/10" },
  { test: /mercado|supermerc|feira/, icon: ShoppingCart, cls: "text-green-400 bg-green-400/10" },
  { test: /farm[aá]cia|rem[eé]dio|drogaria/, icon: Pill, cls: "text-red-400 bg-red-400/10" },
  { test: /academia|\bbjj\b|jiu|gym|crossfit|treino/, icon: Dumbbell, cls: "text-orange-400 bg-orange-400/10" },
  { test: /stream|netflix|prime|disney|hbo|max\b|globoplay/, icon: Tv, cls: "text-red-400 bg-red-400/10" },
  { test: /game|xbox|playstation|nintendo|steam/, icon: Gamepad2, cls: "text-lime-400 bg-lime-400/10" },
  { test: /spotify|deezer|music|tidal/, icon: Music, cls: "text-green-400 bg-green-400/10" },
  { test: /shopee|shein|amazon|aliexpress|mercado livre|compra|loja/, icon: Package, cls: "text-orange-400 bg-orange-400/10" },
  { test: /empr[eé]stimo|linha|cr[eé]dito|acordo|reneg|financ/, icon: HandCoins, cls: "text-amber-400 bg-amber-400/10" },
];

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function billIconFor(name: string) {
  const n = normalize(name);
  const rule = RULES.find((r) => r.test.test(n));
  return rule ?? { icon: Receipt, cls: "text-slate-300 bg-slate-400/10" };
}

export function BillIcon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const { icon: Icon, cls } = billIconFor(name);
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${cls} ${className}`}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}
