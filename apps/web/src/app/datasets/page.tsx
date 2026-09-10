import { DatasetsBrowser } from "@/components/datasets/datasets-browser";

export default function DatasetsPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Datasets</h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
          A modality-aware view of this app&apos;s own prefixes — raw corpora,
          refined output, run stats, and recipes. The full-bucket File Explorer
          lives under Files.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <DatasetsBrowser />
      </div>
    </div>
  );
}
