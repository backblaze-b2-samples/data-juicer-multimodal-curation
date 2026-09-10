"use client";

import { FlaskConical, PlayCircle, Filter, Copy, HardDrive } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingNotice } from "@/components/common/loading-notice";
import { useCurationSummary } from "@/lib/queries";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function CurationStats() {
  const { data: summary, isLoading, error, refetch } = useCurationSummary();

  if (error) {
    return (
      <Card>
        <CardContent className="p-0">
          <ErrorState error={error} onRetry={() => refetch()} />
        </CardContent>
      </Card>
    );
  }

  const cards = [
    { title: "Recipes", value: summary?.recipe_count ?? 0, icon: FlaskConical },
    { title: "Runs", value: summary?.run_count ?? 0, icon: PlayCircle },
    { title: "Pass rate", value: summary ? pct(summary.pass_rate) : "—", icon: Filter },
    { title: "Dedup ratio", value: summary ? pct(summary.dedup_ratio) : "—", icon: Copy },
  ];

  const storage = [
    { label: "Raw", value: summary?.raw_human ?? "0 B" },
    { label: "Refined", value: summary?.refined_human ?? "0 B" },
    { label: "Stats", value: summary?.stats_human ?? "0 B" },
  ];

  return (
    <div className="space-y-6">
      {isLoading && <LoadingNotice className="mb-1" subject="curation metrics" />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <Card key={card.title} className={`card-hover animate-fade-in-up stagger-${i + 1}`}>
            <CardHeader className="flex flex-row items-center justify-between pt-4 pb-2 px-4 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className="stat-icon-wrap">
                <card.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="pb-5 px-4">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="stat-value">{card.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="card-hover">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-4 space-y-0">
          <CardTitle className="card-title">Storage split (B2)</CardTitle>
          <div className="stat-icon-wrap">
            <HardDrive className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          {storage.map((s) => (
            <div key={s.label}>
              <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
              {isLoading ? (
                <Skeleton className="mt-1 h-7 w-20" />
              ) : (
                <div className="stat-value">{s.value}</div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
