import { RunsTable } from "@/components/runs/runs-table";

export default function RunsPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Runs</h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
          History of curation passes, read back from <code>stats/</code> in B2 —
          kept vs filtered counts and dedup ratios per operator.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <RunsTable />
      </div>
    </div>
  );
}
