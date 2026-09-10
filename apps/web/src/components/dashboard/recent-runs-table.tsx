"use client";

import Link from "next/link";
import { PlayCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { RunStatus } from "@data-juicer-multimodal-curation/shared";

const STATUS_VARIANT: Record<RunStatus, "default" | "secondary" | "destructive" | "outline"> = {
  succeeded: "default",
  running: "secondary",
  pending: "outline",
  failed: "destructive",
};

export function RecentRunsTable() {
  const { data: runs = [], isLoading, error, refetch } = useRuns();
  const recent = runs.slice(0, 6);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-4 space-y-0">
        <CardTitle className="card-title">Recent runs</CardTitle>
        <Button asChild variant="outline" size="sm" className="h-7 text-xs">
          <Link href="/runs">View all</Link>
        </Button>
      </CardHeader>
      <CardContent className="p-3">
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} className="px-4" />
        ) : isLoading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            icon={PlayCircle}
            title="No runs yet"
            description="Run a recipe to see curation passes here."
            className="px-4"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipe</TableHead>
                <TableHead>Modality</TableHead>
                <TableHead className="text-right">In → Out</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="max-w-0 truncate font-medium">
                    {run.recipe_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{run.modality}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {run.samples_in} → {run.samples_out}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={STATUS_VARIANT[run.status]}>{run.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
