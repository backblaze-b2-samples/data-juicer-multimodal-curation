export type FileStatus = "uploading" | "complete" | "error";

export interface FileMetadata {
  key: string;
  filename: string;
  folder: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
}

export interface FileMetadataDetail {
  filename: string;
  size_bytes: number;
  size_human: string;
  mime_type: string;
  extension: string;
  md5: string;
  sha256: string;
  uploaded_at: string;
  /** Set when a format-specific extractor was skipped or failed (e.g. an image
   *  above the decompression-bomb decode limit). Core fields stay exact. */
  metadata_warning: string | null;
  // Image-specific
  image_width: number | null;
  image_height: number | null;
  exif: Record<string, string> | null;
  // PDF-specific
  pdf_pages: number | null;
  pdf_author: string | null;
  pdf_title: string | null;
  // Audio/Video
  duration_seconds: number | null;
  codec: string | null;
  bitrate: number | null;
}

export interface FileUploadResponse {
  key: string;
  filename: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
  metadata: FileMetadataDetail | null;
}

/** A short-lived presigned PUT the browser uploads a file directly to B2 with.
 *  `headers` are signed into the URL, so the browser must send them verbatim. */
export interface PresignUploadResponse {
  key: string;
  url: string;
  method: string;
  content_type: string;
  headers: Record<string, string>;
  expires_in: number;
}

export interface DailyUploadCount {
  date: string;
  uploads: number;
}

export interface UploadStats {
  total_files: number;
  total_size_bytes: number;
  total_size_human: string;
  uploads_today: number;
  total_downloads: number;
}

// --- Curation domain -------------------------------------------------------

export type Modality = "image-text" | "video" | "audio" | "text";

export type RunStatus = "pending" | "running" | "succeeded" | "failed";

export interface OperatorConfig {
  name: string;
  params: Record<string, number>;
}

export interface OperatorCatalogEntry {
  name: string;
  label: string;
  modalities: Modality[];
  model_backed: boolean;
  default: boolean;
  description: string;
  params: Record<string, { default?: number; hint?: string }>;
}

export interface RecipeSpec {
  name: string;
  modality: Modality;
  source_prefix: string;
  operators: OperatorConfig[];
  description: string;
}

export interface Recipe {
  id: string;
  name: string;
  modality: Modality;
  source_prefix: string;
  operators: OperatorConfig[];
  description: string;
  created_at: string;
  updated_at: string;
  yaml: string;
  config_key: string;
}

export interface OperatorStat {
  name: string;
  samples_in: number;
  samples_out: number;
  filtered: number;
  kept_ratio: number;
}

export interface RunRecord {
  id: string;
  recipe_id: string;
  recipe_name: string;
  modality: string;
  status: RunStatus;
  samples_in: number;
  samples_out: number;
  filtered: number;
  kept_ratio: number;
  dedup_ratio: number;
  device: string;
  refined_prefix: string | null;
  stats_key: string | null;
  operators: OperatorStat[];
  error: string | null;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
}

export interface CurationSummary {
  recipe_count: number;
  run_count: number;
  raw_bytes: number;
  raw_human: string;
  refined_bytes: number;
  refined_human: string;
  stats_bytes: number;
  stats_human: string;
  total_samples_in: number;
  total_samples_out: number;
  total_filtered: number;
  pass_rate: number;
  dedup_ratio: number;
}

export interface SeedResult {
  created: number;
  prefix: string;
  modality: string;
}
