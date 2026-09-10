import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RecipeList } from "@/components/recipes/recipe-list";

export default function RecipesPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="min-w-0">
          <h1 className="page-title">Recipes</h1>
          <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
            Data-Juicer operator chains for cleaning multimodal corpora. Each
            recipe is stored as a YAML object in B2 under <code>configs/</code>.
          </p>
        </div>
        <Button asChild size="sm" className="h-8 shrink-0">
          <Link href="/recipes/new">
            <Plus className="h-3.5 w-3.5" />
            New recipe
          </Link>
        </Button>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <RecipeList />
      </div>
    </div>
  );
}
