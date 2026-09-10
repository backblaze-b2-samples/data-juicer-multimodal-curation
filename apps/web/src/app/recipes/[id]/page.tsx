"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Pencil, Play } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { RunsTable } from "@/components/runs/runs-table";
import { ApiError } from "@/lib/api-client";
import { useRecipe, useRunRecipe } from "@/lib/queries";

export default function RecipeDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { data: recipe, isLoading, error, refetch } = useRecipe(id);
  const runMutation = useRunRecipe();

  const run = () => {
    if (!recipe) return;
    const toastId = toast.loading(`Running "${recipe.name}"...`);
    runMutation.mutate(recipe.id, {
      onSuccess: (r) =>
        r.status === "succeeded"
          ? toast.success(`Kept ${r.samples_out}/${r.samples_in} samples`, { id: toastId })
          : toast.error(r.error ?? "Run failed", { id: toastId }),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Run failed", { id: toastId }),
    });
  };

  if (error) {
    return <ErrorState error={error} title="Couldn't load recipe" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-8">
      <div className="animate-fade-in flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="min-w-0">
          {isLoading || !recipe ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <>
              <h1 className="page-title">{recipe.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{recipe.modality}</Badge>
                <span>source {recipe.source_prefix}</span>
                <span>·</span>
                <span>{recipe.operators.length} operators</span>
              </div>
              {recipe.description && (
                <p className="mt-2 max-w-prose text-sm text-muted-foreground">
                  {recipe.description}
                </p>
              )}
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button onClick={run} disabled={runMutation.isPending || !recipe}>
            <Play className="h-3.5 w-3.5" />
            {runMutation.isPending ? "Running..." : "Run curation"}
          </Button>
          {recipe && (
            <Button asChild variant="outline">
              <Link href={`/recipes/${recipe.id}/edit`}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
          )}
        </div>
      </div>

      {recipe && (
        <Card>
          <CardHeader className="border-b border-border px-5 py-4">
            <CardTitle className="card-title">Recipe YAML</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="overflow-x-auto p-5 text-xs leading-relaxed">
              <code>{recipe.yaml}</code>
            </pre>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Runs for this recipe
        </h2>
        <RunsTable recipeId={id} />
      </div>
    </div>
  );
}
