"use client";

import { useState } from "react";
import Link from "next/link";
import { FlaskConical, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ApiError } from "@/lib/api-client";
import { useDeleteRecipe, useRecipes, useRunRecipe } from "@/lib/queries";
import type { Recipe } from "@data-juicer-multimodal-curation/shared";

export function RecipeList() {
  const { data: recipes = [], isLoading, error, refetch } = useRecipes();
  const runMutation = useRunRecipe();
  const deleteMutation = useDeleteRecipe();
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);

  const runRecipe = (recipe: Recipe) => {
    const toastId = toast.loading(`Running "${recipe.name}"...`);
    runMutation.mutate(recipe.id, {
      onSuccess: (run) => {
        if (run.status === "succeeded") {
          toast.success(
            `Run finished: ${run.samples_out}/${run.samples_in} samples kept`,
            { id: toastId }
          );
        } else {
          toast.error(run.error ?? "Run failed", { id: toastId });
        }
      },
      onError: (err) => {
        const detail = err instanceof ApiError ? err.message : "Run failed";
        toast.error(detail, { id: toastId });
      },
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    deleteMutation.mutate(target.id, {
      onSuccess: () => toast.success(`Recipe "${target.name}" deleted`),
      onError: (err) => {
        const detail = err instanceof ApiError ? err.message : "Failed to delete";
        toast.error(detail);
      },
      onSettled: () => setDeleteTarget(null),
    });
  };

  if (error) {
    return <ErrorState error={error} title="Couldn't load recipes" onRetry={() => refetch()} />;
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No recipes yet"
        description="Create a Data-Juicer recipe to curate a corpus stored in B2."
        action={
          <Button asChild size="sm">
            <Link href="/recipes/new">
              <Plus className="h-3.5 w-3.5" />
              New recipe
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        {recipes.map((recipe) => (
          <Card key={recipe.id} className="card-hover">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0 space-y-1">
                <Link
                  href={`/recipes/${recipe.id}`}
                  className="font-semibold hover:underline"
                >
                  {recipe.name}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{recipe.modality}</Badge>
                  <span>{recipe.operators.length} operators</span>
                  <span>·</span>
                  <span>source {recipe.source_prefix}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => runRecipe(recipe)}
                  disabled={runMutation.isPending}
                >
                  <Play className="h-3.5 w-3.5" />
                  Run
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/recipes/${recipe.id}`}>View</Link>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${recipe.name}`}
                  onClick={() => setDeleteTarget(recipe)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete recipe?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{" "}
              <strong className="text-foreground">{deleteTarget?.name}</strong> (
              {deleteTarget?.config_key}). Past runs and refined datasets are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteMutation.isPending}
              className={buttonVariants({ variant: "destructive" })}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
