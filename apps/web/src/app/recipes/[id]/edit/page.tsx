"use client";

import { useParams } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { useRecipe } from "@/lib/queries";

export default function EditRecipePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { data: recipe, isLoading, error, refetch } = useRecipe(id);

  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Edit recipe</h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
          Adjust operators and thresholds. The form opens pre-filled from the
          stored recipe YAML.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2">
        {error ? (
          <ErrorState error={error} title="Couldn't load recipe" onRetry={() => refetch()} />
        ) : isLoading || !recipe ? (
          <div className="space-y-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <RecipeForm recipe={recipe} />
        )}
      </div>
    </div>
  );
}
