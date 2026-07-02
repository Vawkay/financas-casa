import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryManager } from "@/components/category-manager";
import { getCategories } from "@/lib/data";

export default async function CategoriasPage() {
  const categories = await getCategories();

  return (
    <div>
      <PageHeader
        title="Categorias"
        subtitle="Organize seus gastos. As categorias aparecem na importação, nas contas do mês e nos lançamentos."
      />
      <Card>
        <CardContent className="p-5">
          <CategoryManager
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              color: c.color,
              isSystem: c.isSystem,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
