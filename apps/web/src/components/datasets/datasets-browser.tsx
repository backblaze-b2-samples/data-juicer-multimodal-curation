"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Database, Download, FileText, ImageIcon, Sparkles } from "lucide-react";
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
import { FilePreview } from "@/components/files/file-preview";
import { ApiError } from "@/lib/api-client";
import { startBrowserDownload } from "@/lib/browser-download";
import {
  useDownloadUrl,
  useFiles,
  usePreviewUrl,
  useSeedDataset,
} from "@/lib/queries";
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

function isPreviewable(file: FileMetadata): boolean {
  return (
    file.content_type.startsWith("image/") ||
    file.content_type === "application/pdf"
  );
}

/**
 * Inline thumbnail for a dataset object. Fetches its own short-lived preview URL
 * only for images (non-image rows make no extra request and show a type icon),
 * and only once the row has actually scrolled into view (IntersectionObserver
 * gated) — so a long, mostly off-screen grid doesn't fire hundreds of preview
 * requests up front. While a visible image row's URL is resolving it shows a
 * skeleton, so a pending row reads as "loading" rather than empty/broken.
 * Clicking the resolved thumbnail opens the shared FilePreview dialog for the
 * full-size media.
 */
function DatasetThumb({
  file,
  onOpen,
}: {
  file: FileMetadata;
  onOpen: (file: FileMetadata) => void;
}) {
  const isImage = file.content_type.startsWith("image/");
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!isImage || inView) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isImage, inView]);

  const { data, isLoading } = usePreviewUrl(file.key, isImage && inView);
  const url = data?.url ?? file.url ?? null;

  if (isImage && url) {
    return (
      <button
        type="button"
        onClick={() => onOpen(file)}
        aria-label={`Preview ${file.filename}`}
        className="relative h-11 w-11 overflow-hidden rounded border border-border bg-muted/30 transition hover:ring-2 hover:ring-primary"
      >
        <Image
          src={url}
          alt={file.filename}
          width={44}
          height={44}
          className="h-11 w-11 object-cover"
          unoptimized
        />
      </button>
    );
  }

  if (isImage && inView && isLoading) {
    return (
      <div ref={containerRef} className="h-11 w-11 overflow-hidden rounded border border-border">
        <Skeleton className="h-11 w-11 rounded-none" />
      </div>
    );
  }

  const Icon = isImage ? ImageIcon : FileText;
  return (
    <div
      ref={containerRef}
      className="flex h-11 w-11 items-center justify-center rounded border border-border bg-muted/30 text-muted-foreground"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </div>
  );
}

export function DatasetsBrowser() {
  const [prefix, setPrefix] = useState("raw/");
  const [seedModality, setSeedModality] = useState<"text" | "image-text">("image-text");
  const { data: files = [], isLoading, error, refetch } = useFiles(prefix, 500);
  const seedMutation = useSeedDataset();
  const downloadMutation = useDownloadUrl();
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const openPreview = (file: FileMetadata) => {
    setPreviewFile(file);
    setPreviewOpen(true);
  };

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
    <>
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
                        <TableHead className="w-16">Preview</TableHead>
                        <TableHead>Key</TableHead>
                        <TableHead className="text-right">Size</TableHead>
                        <TableHead className="w-24 text-right">Download</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupFiles.map((f) => (
                        <TableRow key={f.key}>
                          <TableCell>
                            <DatasetThumb file={f} onOpen={openPreview} />
                          </TableCell>
                          <TableCell className="max-w-0 truncate font-mono text-xs">
                            {isPreviewable(f) ? (
                              <button
                                type="button"
                                onClick={() => openPreview(f)}
                                title={f.key}
                                className="max-w-full truncate text-left underline-offset-2 hover:text-foreground hover:underline"
                              >
                                {f.key}
                              </button>
                            ) : (
                              f.key
                            )}
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
      {/* Reuse the Files page's media preview so refined/raw items render as
          real media (image/PDF), not just filenames. No onDelete -> the
          Datasets browser is a read-only review surface. */}
      <FilePreview
        file={previewFile}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onDownload={download}
      />
    </>
  );
}
