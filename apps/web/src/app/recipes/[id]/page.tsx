"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Pencil, Play } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ErrorState } from "@/components/ui/error-state";
import { RunsTable } from "@/components/runs/runs-table";
import { ApiError } from "@/lib/api-client";
import { useRecipe, useRunRecipe } from "@/lib/queries";

// A curation pass runs synchronously server-side (~90s) with no progress stream.
// Rather than build one, show an honest client-side elapsed timer plus an
// approximate stage label so the button isn't a frozen "Running..." for a
// minute and a half. The stage is a time-based estimate, not a backend signal.
function runStage(seconds: number): string {
  if (seconds < 4) return "Preparing input";
  if (seconds < 12) return "Localizing media";
  if (seconds < 75) return "Running operators";
  return "Writing refined output";
}

// The determinate progress bar is driven off the same time-based estimate as
// `runStage`, not a backend signal (there is no progress stream). Capped
// below 100 while the run is actually in flight so the bar never claims
// "done" before the backend says so; `run()` snaps it to 100 only once the
// mutation settles (success or error).
const ESTIMATED_RUN_SECONDS = 90;
const RUNNING_PROGRESS_CAP = 90;

function progressFromElapsed(seconds: number): number {
  return Math.min(
    RUNNING_PROGRESS_CAP,
    Math.round((seconds / ESTIMATED_RUN_SECONDS) * 100),
  );
}

export default function RecipeDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { data: recipe, isLoading, error, refetch } = useRecipe(id);
  const runMutation = useRunRecipe();
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  // Kept visible slightly past `isPending` flipping false so the 100% snap
  // (set in the mutation callbacks below) is actually seen rather than
  // unmounting in the same tick the run finishes.
  const [showRunUi, setShowRunUi] = useState(false);
  const startRef = useRef<number | null>(null);

  // Tick the elapsed counter and derived progress while a run is in flight.
  // The interval callback is the only writer, so this is not a
  // set-state-in-effect.
  useEffect(() => {
    if (!runMutation.isPending) return;
    const timer = setInterval(() => {
      if (startRef.current !== null) {
        const seconds = Math.floor((Date.now() - startRef.current) / 1000);
        setElapsed(seconds);
        setProgress(progressFromElapsed(seconds));
      }
    }, 250);
    return () => clearInterval(timer);
  }, [runMutation.isPending]);

  const run = () => {
    if (!recipe) return;
    startRef.current = Date.now();
    setElapsed(0);
    setProgress(0);
    setShowRunUi(true);
    const toastId = toast.loading(`Running "${recipe.name}"...`);
    const onSettled = () => {
      setProgress(100);
      window.setTimeout(() => setShowRunUi(false), 600);
    };
    runMutation.mutate(recipe.id, {
      onSuccess: (r) => {
        onSettled();
        if (r.status === "succeeded") {
          toast.success(`Kept ${r.samples_out}/${r.samples_in} samples`, { id: toastId });
        } else {
          toast.error(r.error ?? "Run failed", { id: toastId });
        }
      },
      onError: (err) => {
        onSettled();
        toast.error(err instanceof ApiError ? err.message : "Run failed", { id: toastId });
      },
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
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Button onClick={run} disabled={runMutation.isPending || showRunUi || !recipe}>
              <Play className="h-3.5 w-3.5" />
              {runMutation.isPending ? `Running… ${elapsed}s` : "Run curation"}
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
          {showRunUi && (
            <div className="flex w-48 flex-col gap-1.5">
              <Progress value={progress} className="h-1.5" />
              <p
                className="text-xs text-muted-foreground tabular-nums"
                aria-live="polite"
              >
                {runMutation.isPending
                  ? `${runStage(elapsed)} · a full pass takes ~90s`
                  : "Done"}
              </p>
            </div>
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
