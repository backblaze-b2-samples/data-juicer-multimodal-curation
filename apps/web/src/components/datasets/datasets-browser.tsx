"use client";

import { useState } from "react";
import { Database, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import { startBrowserDownload } from "@/lib/browser-download";
import { useDownloadUrl, useFiles, useSeedDataset } from "@/lib/queries";
import type { FileMetadata } from "@data-juicer-multimodal-curation/shared";

const PREFIXES = [
  { value: "raw/", label: "raw/ — source corpora" },
  { value: "refined/", label: "refined/ — cleaned output" },
  { value: "stats/", label: "stats/ — run records" },
  { value: "configs/", label: "configs/ — recipes" },
];

function modalityOf(key: string): string {
  if (key.includes("image-text")) return "image-text";
  if (key.includes("video")) return "video";
  if (key.includes("audio")) return "audio";
  return "text";
}

export function DatasetsBrowser() {
  const [prefix, setPrefix] = useState("raw/");
  const [seedModality, setSeedModality] = useState<"text" | "image-text">("image-text");
  const { data: files = [], isLoading, error, refetch } = useFiles(prefix, 500);
  const seedMutation = useSeedDataset();
  const downloadMutation = useDownloadUrl();

  const seed = () => {
    const toastId = toast.loading("Seeding a tiny synthetic demo corpus...");
    seedMutation.mutate(seedModality, {
      onSuccess: (res) =>
        toast.success(`Seeded ${res.created} samples into ${res.prefix}`, {
          id: toastId,
        }),
      onError: (err) => {
        const detail = err instanceof ApiError ? err.message : "Seeding failed";
        toast.error(detail, { id: toastId });
      },
    });
  };

  const download = (file: FileMetadata) => {
    downloadMutation.mutate(file, {
      onSuccess: ({ url }) => startBrowserDownload(url, file.filename),
      onError: (err) => {
        const detail = err instanceof ApiError ? err.message : "Download failed";
        toast.error(detail);
      },
    });
  };

  const grouped = new Map<string, FileMetadata[]>();
  for (const f of files) {
    const group = prefix === "raw/" ? modalityOf(f.key) : prefix;
    const list = grouped.get(group) ?? [];
    list.push(f);
    grouped.set(group, list);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 space-y-0">
          <CardTitle className="card-title">Seed a demo corpus</CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={seedModality}
              onValueChange={(v) => setSeedModality(v as "text" | "image-text")}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image-text">image-text</SelectItem>
                <SelectItem value="text">text</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={seed} disabled={seedMutation.isPending} size="sm">
              <Sparkles className="h-3.5 w-3.5" />
              {seedMutation.isPending ? "Seeding..." : "Seed demo corpus"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5 text-sm text-muted-foreground">
          Generates a tiny, synthetic, keyless corpus (PIL images + text JSONL)
          under <code>raw/</code> so a curation run finishes in seconds — no
          download, no license review, no second key.
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 space-y-0">
          <CardTitle className="card-title">Browse datasets</CardTitle>
          <Select value={prefix} onValueChange={setPrefix}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PREFIXES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-5">
          {error ? (
            <ErrorState error={error} title="Couldn't load objects" onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <EmptyState
              icon={Database}
              title={`Nothing under ${prefix}`}
              description="Seed a demo corpus or upload data, then run a recipe to populate refined/ and stats/."
            />
          ) : (
            <div className="space-y-6">
              {[...grouped.entries()].map(([group, groupFiles]) => (
                <div key={group} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{group}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {groupFiles.length} objects
                    </span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Key</TableHead>
                        <TableHead className="text-right">Size</TableHead>
                        <TableHead className="w-24 text-right">Download</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupFiles.map((f) => (
                        <TableRow key={f.key}>
                          <TableCell className="max-w-0 truncate font-mono text-xs">
                            {f.key}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {f.size_human}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Download ${f.filename}`}
                              onClick={() => download(f)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
