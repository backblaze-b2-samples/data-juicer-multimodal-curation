import Link from "next/link";
import { Plus, Database } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CurationStats } from "@/components/dashboard/curation-stats";
import { RecentRunsTable } from "@/components/dashboard/recent-runs-table";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Multimodal curation overview — recipes, runs, and raw vs refined
            storage on Backblaze B2.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="h-8">
            <Link href="/datasets">
              <Database className="h-3.5 w-3.5" />
              Datasets
            </Link>
          </Button>
          <Button asChild size="sm" className="h-8">
            <Link href="/recipes/new">
              <Plus className="h-3.5 w-3.5" />
              New recipe
            </Link>
          </Button>
        </div>
      </div>
      <CurationStats />
      <div className="animate-fade-in-up stagger-4">
        <RecentRunsTable />
      </div>
    </div>
  );
}
