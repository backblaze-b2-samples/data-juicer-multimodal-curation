# Build plan — `data-juicer-multimodal-curation`

Source of truth (Phase 0 clone):
`.claude/scratch/vcsk-07f432c0-8c58-441b-886d-9a48a65da3e0/`. All keep/trim/add
deltas below are computed against that tree only.

## 1. Purpose

`data-juicer-multimodal-curation` is a local, B2-backed control plane for
**multimodal training-data curation** built on
[Data-Juicer](https://github.com/modelscope/data-juicer). It is for AI researchers
and dataset engineers cleaning heterogeneous foundation-model corpora — image-text
pairs, video, audio, and text — that live in Backblaze B2. The user authors a
Data-Juicer **recipe** (a composable operator chain: dedup, length/quality filters,
resolution/aspect checks), stored as YAML in B2 `configs/`, then **runs** it: the
app streams raw shards from B2 `raw/`, applies the operators **locally on OSS**
(no managed cloud ETL, no second API key — B2 credentials only), writes the refined
dataset to `refined/` and per-operator statistics JSON to `stats/`. B2 is the sole
storage layer for raw corpora, recipes, refined outputs, and run stats — all over
the S3-compatible API with a custom user agent. The whole point is that a lab keeps
hundreds of TB of raw + refined multimodal data on B2 and drives curation from a
local box, with write amplification (refined shards + stats accumulating per pass)
making B2 the natural home.

Data-Juicer is the vendor engine and **must** power the headline capability — never
substitute a hand-rolled filter loop for the operator pipeline (local sampleapps
convention: a vendor-themed sample uses that vendor's own engine).

## 2. Architecture delta from vibe-coding-starter-kit

The starter kit is the ceiling. Strip only what this app doesn't need; keep the
reusable B2 scaffolding.

### KEEP (as-is — do not strip/rename/replace)
- **UI kit / design system**: `apps/web/src/components/ui/`, `app/globals.css`
  tokens, `/design` page. Build new screens from these primitives.
- **Full-bucket File Explorer** (MANDATORY, never removable): `/files` route,
  `app/files/`, `components/files/`, its sidebar entry. This is the starter's
  bucket explorer and stays even though this sample adds its own scoped explorer.
- **Upload**: `/upload` route, `app/upload/`, `components/upload/`, sidebar entry —
  the on-ramp for landing raw multimodal assets into `raw/`.
- **Backend layering** `types → config → repo → service → runtime` and all its
  invariants (boto3 only in `repo/`, Pydantic at boundaries, <300-line files,
  structural tests). The whole B2 access layer: `repo/b2_client.py`,
  `list_cache.py`, `counter.py`, `b2_object.py`, `b2_upload.py`,
  `runtime/health.py`, `metrics.py`, `ratelimit.py`.
- **Settings** page + `settings-form.tsx` (the form-UX exemplar), **theme**,
  **command palette**, **health banner**, layout/sidebar shell.
- **Contract/verification machinery**: OpenAPI export/check, `check:agent-docs`,
  `verify`, CI workflow, `infra/railway` + `infra/vercel` delivery contracts,
  Playwright harness. Adapt content, keep the gates.
- **Metadata extraction** (`service/metadata.py`, `docs/features/metadata-extraction.md`)
  — still useful for inspecting shard/media metadata; keep.

### TRIM (remove from starter)
- **Dashboard defaults**: the file-storage stat cards / upload chart / recent-uploads
  table in `components/dashboard/` are illustrative and get **rewritten** (not
  deleted) into curation metrics (see §4.4). This is the one screen the starter
  contract explicitly says to rebuild per app.
- No structural deletions. Everything else is adaptation, not removal. (Bucket
  explorer tension note: this sample clearly has a narrower "datasets" explorer,
  but the generic full-bucket `/files` explorer is kept anyway per the
  non-negotiable-keep rule.)

### ADD (new for data-juicer-multimodal-curation)
- **Curation Recipes** — the primary entity (§4.5). New route `/recipes`, full
  CRUD+run UI. Recipes are Data-Juicer YAML operator chains persisted as objects in
  B2 `configs/` (no database — consistent with the starter's B2-is-the-only-store
  design). New backend slice: `types/recipes.py`, `service/recipes.py`,
  `runtime/recipes.py`; B2 recipe I/O added to `repo/` (put/get/list/delete of
  `configs/*.yaml`).
- **Curation runner** — `service/curation.py` orchestrates a run: read recipe YAML
  → download `raw/` shards (via repo) → invoke **Data-Juicer** locally → upload
  refined output to `refined/` and per-operator stats JSON to `stats/` (via repo) →
  return a run record. Data-Juicer is local compute, so it lives in `service/`
  (not an external API — nothing new in `repo/` except the B2 put/get it calls).
- **Runs view** — route `/runs` (or a section on `/recipes/<id>`): history of
  curation passes + per-operator stats read back from `stats/` (kept counts,
  filtered counts, dedup ratio per operator).
- **Datasets Library** (the MANDATED sample-specific scoped explorer) — route
  `/datasets`. A modality-aware browse of the sample's own prefixes (`raw/`,
  `refined/`, `stats/`, `configs/`) — distinct from, and additional to, the kept
  full-bucket `/files` explorer. Reuses the file-browser components scoped to a
  prefix selector; groups by modality (image-text / video / audio / text).
- **Sidebar**: add Recipes, Runs, Datasets entries alongside Dashboard, Upload,
  Files, Settings.
- **Data-Juicer dependency**: `py-data-juicer` (import `data_juicer`) added to
  `services/api/requirements.txt`; regenerate `requirements.lock` via the starter's
  reviewed lock workflow. Heavy (pulls torch + HF `datasets`) — see §7.

## 3. B2 surface (S3 operations)

All via the existing `repo/b2_client.py` S3 client (custom UA, signature v4).
**S3-compatible API only — zero b2-native usage.**

| Operation | Used for |
|-----------|----------|
| `list_objects_v2` | list recipes (`configs/`), raw shards (`raw/`), refined (`refined/`), stats (`stats/`); dashboard aggregates |
| `get_object` | read recipe YAML; stream raw shards for processing; read stats JSON; download refined |
| `put_object` | write recipe YAML → `configs/`; write refined shards → `refined/`; write stats JSON → `stats/` |
| `head_object` | shard/recipe metadata |
| `delete_object` | delete a recipe (`configs/<name>.yaml`) |
| `generate_presigned_url` | download refined shards / stats from the browser |

No b2-native API anywhere. Data-Juicer reads/writes local temp dirs only; **all**
B2 traffic goes through the repo layer's boto3 client — Data-Juicer never gets its
own S3 client, so the custom UA is never bypassed. (Alternative s3fs streaming is
explicitly rejected to avoid a second, UA-carrying access surface.)

### B2 standards — REQUIRED remediation (the starter fails these; `/b2-doctor` gates them)
The starter kit ships **non-standard** B2 env names and a hardcoded region; every
sample must standardize. This is the single largest B2-standards task — do it and
let `/b2-doctor` arbitrate:
1. **Env names** — `.env.example` must contain the five exact keys:
   `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`, `B2_REGION`
   (four real entries) and `B2_PUBLIC_URL_BASE` (may be commented). Rename the
   starter's `B2_KEY_ID` → `B2_APPLICATION_KEY_ID`; replace `B2_ENDPOINT` with
   `B2_REGION` as the source of truth; `B2_PUBLIC_URL` → `B2_PUBLIC_URL_BASE`.
2. **Config** — `config/settings.py`: `b2_key_id` → `b2_application_key_id`; add
   `b2_region`; derive the endpoint from region
   (`https://s3.{b2_region}.backblazeb2.com`) via a property; **remove the
   hardcoded `https://s3.us-west-004...` default literal** (the `hardcoded_region`
   check flags it); `b2_public_url` → `b2_public_url_base`.
3. **Propagate** the renames through `repo/b2_client.py`, `scripts/setup_b2_cors.py`,
   `scripts/doctor.mjs`, tests (`conftest.py`, `test_health.py`, live tests), and
   every doc that names the old vars.
4. **Custom UA** — every `boto3.client("s3"...)` sets
   `user_agent_extra="b2ai-data-juicer-multimodal-curation"` (b2-doctor requires
   `b2ai-<package.json name>`). The starter has one client in `b2_client.py`.
5. **UTM** — `utm_content=b2ai-data-juicer-multimodal-curation` on every
   backblaze.com link (sidebar footer, README). One token across UA + UTM
   (branding check).

## 4. Key features (README + `docs/features/` stubs)

**No external API provider.** Every feature's heavy work is Data-Juicer on-device.
Per feature the deployment field is explicit:

1. **Curation Recipes (CRUD + run)** — `deployment: local`. Author/store/run
   Data-Juicer operator chains. Engine: Data-Juicer (OSS, on-device). Provider: none.
   Cost/run: **$0** (local compute, B2 storage only). Env key: none beyond `B2_*`.
2. **Local multimodal curation run** — `deployment: local`. Streams `raw/` shards,
   applies operators, writes `refined/` + `stats/`. CPU default, GPU autodetect
   (CUDA → MPS → CPU). Provider: none. Cost/run: $0.
3. **Datasets Library** — scoped, modality-aware explorer of `raw|refined|stats|configs`.
4. **Curation dashboard** — raw vs refined storage, samples processed / kept /
   filtered, dedup & pass-rate ratios, recent runs.
5. **File Explorer (kept) + Upload (kept)** — land raw assets; inspect any object.

**No Genblaze**: the description does not mention Genblaze / `genblaze-*` /
`genblaze-s3`, so provider calls are NOT routed through the Genblaze SDK. (Moot
anyway — there is no external AI provider.)

**`deployment: local` hard rule (from api-provider-selection.md §Hard rules):** the
curation runner MUST default to CPU and auto-detect the first available of
CUDA → Apple MPS → CPU at runtime, never hard-require a GPU. Data-Juicer's ML-backed
operators run on torch/HF where **MPS support is weak**, so ML operators fall back
**CUDA → CPU** (note in `ARCHITECTURE.md`). The default demo recipe uses only
lightweight CPU operators (below); model-backed operators are selectable but flagged
as requiring a model download and GPU-preferred.

### 4.4 Dashboard rewrite (starter contract: rewrite per app)
Replace file-storage cards with curation metrics, all flowing through
`runtime → service → repo` and exposed via TanStack Query hooks in `lib/queries.ts`
(no bare `useEffect + fetch`): storage split raw vs refined vs stats; total
samples processed; kept vs filtered (pass rate); dedup ratio; recipe count; recent
runs table (recipe, modality, samples in/out, when). Update
`docs/features/dashboard.md` in the same change.

### 4.5 Primary-entity lifecycle (UI completeness — mandatory)
**Primary entity: Curation Recipe.** The app supports all five lifecycle verbs and
the UI exposes ALL of them — nothing omitted, so Phase 5 `omitted_ui_verbs` is empty:
- **create** — `/recipes/new` form → writes `configs/<name>.yaml` to B2.
- **read** — `/recipes` list + `/recipes/<id>` detail (operator chain + rendered YAML).
- **edit** — `/recipes/<id>/edit` form, pre-filled from the stored YAML.
- **delete** — from list/detail, with the starter's confirm dialog → `delete_object`.
- **run** — "Run curation" action → launches a pass, shows pending/progress, links
  to the produced run + refined output. One run at a time (see §7).

Scope stays one entity + its CRUD/run verbs — no hypothetical extras. A run record
and stats are **outputs** of the run verb (surfaced in Runs/Datasets), not a second
managed entity.

### 4.6 Form UX conventions (create/edit recipe forms)
Exemplar: `apps/web/src/components/settings/settings-form.tsx` (does selectors +
create-defaults already). For the recipe create/edit form:

**(a) Finite-value fields → selectors (never free text), on BOTH create and edit:**
- **modality** — `RadioGroup`/`Select`: `image-text | video | audio | text`.
- **source prefix** — `Select`: `raw/` (default) and any other discovered top-level
  prefixes.
- **operators** — multi-select checklist from a **finite operator catalog** (a
  constant list, not free text). Default-recipe (CPU, no model download):
  `text_length_filter`, `character_repetition_filter`, `word_repetition_filter`,
  `alphanumeric_filter`, `document_deduplicator`, `image_shape_filter`,
  `image_aspect_ratio_filter`, `image_size_filter`, `image_deduplicator`.
  Model-backed operators (e.g. `image_nsfw_filter`, quality/aesthetic scorers,
  `language_id_score_filter`) appear in the catalog **flagged** "downloads a model /
  GPU-preferred" and are off by default.
- Per-operator numeric thresholds → `Input type=number`.

**(b) CREATE form safe defaults as guidance (placeholder / `FormDescription` only —
never an autofill button):** e.g. recipe name placeholder `image-text-baseline`;
threshold hints `text_length_filter: min 10 / max 100000`, `image_size_filter:
min 5KB`, `image_aspect_ratio_filter: 0.333–3.0`, `image_shape_filter: min 128×128`.
The EDIT form opens pre-filled from the real recipe YAML (no hint defaults).

## 5. Doc transforms
- **Rewrite**: `README.md` (curation quick-start; humans-first ordering — quick
  start + visual proof early, keep a When-to-use / FAQ section for AEO), `PRODUCT.md`
  (curation product & users), `ARCHITECTURE.md` (add Data-Juicer engine, B2 prefix
  layout `raw|configs|refined|stats`, run data-flow, device-autodetect note),
  `docs/features/dashboard.md`, `docs/app-workflows.md` (recipe→run→refined journey).
- **New feature docs**: `docs/features/recipes.md`, `docs/features/curation-run.md`,
  `docs/features/datasets-library.md`. Seed from `docs/features/_template.md`.
- **Keep/adapt**: `docs/features/file-browser.md`, `file-upload.md`, `settings.md`,
  `metadata-extraction.md`; `docs/SECURITY.md`, `RELIABILITY.md`, `verification.md`
  (add the Data-Juicer dep + run constraints), `frontend-conventions.md`.
- **AGENTS.md** + shims (`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`):
  update the display name / attribution token and register any new doc; keep it
  passing `check:agent-docs`.

## 6. Rename table (`vibe-coding-starter-kit` → `data-juicer-multimodal-curation`)

| Form | From | To |
|------|------|----|
| kebab slug (dir, repo, image tags, workflow slugs, railway/vercel names) | `vibe-coding-starter-kit` (26+12 hits) | `data-juicer-multimodal-curation` |
| npm workspace scope | `@vibe-coding-starter-kit/shared` (15) | `@data-juicer-multimodal-curation/shared` |
| root `package.json` name | `vibe-coding-starter-kit` | `data-juicer-multimodal-curation` |
| Title Case display (`APP_NAME`, `API_TITLE`, README H1, docs) | `Vibe Coding Starter Kit` (13) | `Data-Juicer Multimodal Curation` |
| short slug | `vcsk` / `VCSK` (5) | `djmc` / `DJMC` |
| custom UA (`user_agent_extra`) | `b2ai-oss-start` (8) | `b2ai-data-juicer-multimodal-curation` |
| UTM content tag (`utm_content=`) | `b2ai-oss-start` | `b2ai-data-juicer-multimodal-curation` |
| API title | `Vibe Coding Starter Kit API` | `Data-Juicer Multimodal Curation API` |

`APP_NAME` in `apps/web/src/lib/app-config.ts` is the single source; `API_TITLE`
in `services/api/main.py` must stay derived from it (branding check). Import
`APP_NAME` in components — never hardcode the display name outside `app-config.ts`.

## 7. Build constraints & risks (for the builder)
- **Data-Juicer install is heavy** (`py-data-juicer` → torch + HF `datasets` + many
  deps). Add to `requirements.txt`, regenerate `requirements.lock` in a fresh
  Python 3.12 venv, verify `pnpm verify:api` passes. If a full curation-op subset
  can't resolve on this arch, pin the minimal working set and record it.
- **Native-ML crash containment** (local sampleapps convention + memory
  `verify-killed-under-concurrent-ml-contention`): run **one** curation pass at a
  time; wrap the Data-Juicer invocation so a native crash/segfault or macOS banner
  is contained and surfaced as a typed JSON error — never let it kill the API.
  Surface a native failure to the user only when it BLOCKS the run. Consider
  invoking Data-Juicer's Executor in an isolated **subprocess** (e.g. its
  `dj-process` entrypoint against a temp config) rather than in-process, to keep
  torch/multiprocessing state out of the FastAPI worker; fall back to in-process
  only if the subprocess path is impractical. Keep `np=1` for the demo.
- **Device autodetect**: CUDA → MPS → CPU, CPU default; ML operators fall back
  CUDA → CPU (weak MPS). No hard GPU requirement.
- **Demo scale & seed data**: default to a tiny corpus so a run finishes in seconds
  synchronously with a pending state. Do **not** commit binary corpora (skill
  forbids binary assets here, and demo assets must be synthetic). Provide the raw
  on-ramp via the kept Upload page; optionally a server-side utility that
  synthesizes a tiny demo corpus (PIL-generated images + text JSONL) into `raw/` on
  demand — programmatic, no committed binaries.
- **Layering**: Data-Juicer stays in `service/`; only `repo/` touches B2/boto3; new
  routes re-export `docs/api/openapi.json` and register in `API_CLIENT_ROUTES` +
  `lib/queries.ts`; backend-only routes go in `SERVER_ONLY_OPERATIONS`. Every new
  behavior gets a test. Keep authored Python files < 300 lines.
- **Verify gate**: `pnpm run setup` then `pnpm verify` must pass before done; run
  `/b2-doctor` and clear all ❌.

## 8. Verdict criteria
PASS when `/b2-doctor` and `sample-reviewer` return no ❌ (⚠️ may remain). The three
B2 standards (S3-only, custom UA `b2ai-data-juicer-multimodal-curation` on every S3
client, standardized `B2_*` env names) are hard gates.
