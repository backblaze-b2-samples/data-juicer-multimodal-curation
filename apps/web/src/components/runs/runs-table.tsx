"use client";

import { PlayCircle } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRuns } from "@/lib/queries";
import type { RunRecord, RunStatus } from "@data-juicer-multimodal-curation/shared";

const STATUS_VARIANT: Record<RunStatus, "default" | "secondary" | "destructive" | "outline"> = {
  succeeded: "default",
  running: "secondary",
  pending: "outline",
  failed: "destructive",
};

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function RunCard({ run }: { run: RunRecord }) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3 space-y-0">
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[run.status]}>{run.status}</Badge>
          <span className="font-semibold">{run.recipe_name}</span>
          <Badge variant="secondary">{run.modality}</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          {new Date(run.started_at).toLocaleString()} · device {run.device}
          {run.duration_seconds !== null && <> · {run.duration_seconds}s</>}
        </div>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        {run.status === "failed" ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {run.error ?? "Run failed."}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat label="Samples in" value={run.samples_in} />
            <Stat label="Samples kept" value={run.samples_out} />
            <Stat label="Pass rate" value={pct(run.kept_ratio)} />
            <Stat label="Dedup ratio" value={pct(run.dedup_ratio)} />
          </div>
        )}

        {run.operators.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operator</TableHead>
                <TableHead className="text-right">In</TableHead>
                <TableHead className="text-right">Out</TableHead>
                <TableHead className="text-right">Filtered</TableHead>
                <TableHead className="text-right">Kept</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.operators.map((op) => (
                <TableRow key={op.name}>
                  <TableCell className="font-mono text-xs">{op.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{op.samples_in}</TableCell>
                  <TableCell className="text-right tabular-nums">{op.samples_out}</TableCell>
                  <TableCell className="text-right tabular-nums">{op.filtered}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(op.kept_ratio)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {run.refined_prefix && (
          <p className="text-xs text-muted-foreground">
            Refined output: <code>{run.refined_prefix}</code> · stats:{" "}
            <code>{run.stats_key}</code>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

export function RunsTable({ recipeId }: { recipeId?: string }) {
  const { data: runs = [], isLoading, error, refetch } = useRuns();
  const shown = recipeId ? runs.filter((r) => r.recipe_id === recipeId) : runs;

  if (error) {
    return <ErrorState error={error} title="Couldn't load runs" onRetry={() => refetch()} />;
  }
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }
  if (shown.length === 0) {
    return (
      <EmptyState
        icon={PlayCircle}
        title="No runs yet"
        description="Run a recipe to curate a corpus. Each pass records its per-operator stats here."
      />
    );
  }
  return (
    <div className="space-y-4">
      {shown.map((run) => (
        <RunCard key={run.id} run={run} />
      ))}
    </div>
  );
}
