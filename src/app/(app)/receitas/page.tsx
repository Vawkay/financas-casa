import { PageHeader, ComingSoon } from "@/components/page-header";

export default function ReceitasPage() {
  return (
    <div>
      <PageHeader
        title="Receitas & Horas PJ"
        subtitle="Fontes de renda (ABI/Wise, Klarz/PicPay) e cálculo Valor-Hora × Horas."
      />
      <ComingSoon phase="Fase 4" />
    </div>
  );
}
