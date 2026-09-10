<!-- last_verified: 2026-09-10 -->
# Data-Juicer Multimodal Curation

A local, B2-backed control plane for **multimodal training-data curation** built on
[Data-Juicer](https://github.com/modelscope/data-juicer). Author a Data-Juicer
**recipe** (a composable operator chain — dedup, length/quality filters,
resolution/aspect checks), then **run** it: the app streams raw shards from
Backblaze B2, cleans them locally with Data-Juicer, and writes the refined
dataset plus per-operator stats back to B2. No managed cloud ETL, no second API
key — **[Backblaze B2](https://www.backblaze.com/sign-up/ai-cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-data-juicer-multimodal-curation)**
credentials only. B2 is the single storage layer for raw corpora, recipes,
refined outputs, and run stats — all over the S3-compatible API.

**What you get out of the box:**
- **Curation Recipes** — full CRUD + run UI for Data-Juicer operator chains, stored as YAML in B2 `configs/`
- **Local curation runs** — stream `raw/` shards, apply operators on-device (CPU by default; CUDA → MPS → CPU auto-detect), write `refined/` + `stats/`
- **Runs history** — kept vs filtered counts and dedup ratios, per operator, read back from B2 `stats/`
- **Datasets Library** — a modality-aware view of the app's own `raw / refined / stats / configs` prefixes
- **Curation dashboard** — raw vs refined storage, samples processed / kept / filtered, pass and dedup ratios
- **Kept starter scaffolding** — full-bucket File Explorer, drag-and-drop Upload, FastAPI backend with strict layered architecture, structural tests, and agent-first docs

## Quick Start

You need: Node.js >= 20, pnpm >= 9, Python >= 3.12, and a free **[Backblaze B2 account](https://www.backblaze.com/sign-up/ai-cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-data-juicer-multimodal-curation)**.

**1. Run setup**

```bash
pnpm run setup
```

This copies `.env.example` to `.env` only when `.env` does not already exist,
installs workspace dependencies from `pnpm-lock.yaml`, creates
`services/api/.venv` if missing, validates that an existing venv uses Python
3.12+, and installs the API's committed Python 3.12 resolution from
`services/api/requirements.lock`. It is safe to rerun and never overwrites an
existing `.env`.

> Use the `pnpm run` form: `setup` (like `doctor`) is a built-in pnpm command
> before pnpm 11, so bare `pnpm setup` would run pnpm's own command instead of
> this script.

**2. Add your B2 credentials**

Open `.env` and head to the [Backblaze B2 dashboard](https://secure.backblaze.com/b2_buckets.htm?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-data-juicer-multimodal-curation):

1. **Create a bucket.** Paste each value into `.env`:
   - **Bucket Unique Name** → `B2_BUCKET_NAME`
   - **Region** (the `<region>` in the S3 endpoint `s3.<region>.backblazeb2.com`) → `B2_REGION`
2. **Create an application key** with `Read and Write` permission:
   - **keyID** → `B2_APPLICATION_KEY_ID`
   - **applicationKey** → `B2_APPLICATION_KEY` *(only shown once — paste it now)*

The S3 endpoint is derived from `B2_REGION` (no endpoint literal is hardcoded).

> Walkthroughs: [creating a bucket](https://www.backblaze.com/docs/cloud-storage-create-and-manage-buckets) and [creating app keys](https://www.backblaze.com/docs/cloud-storage-create-and-manage-app-keys).

**3. Install the curation engine (optional, for real runs)**

The default `pnpm run setup` keeps the venv light so the credential-free gates
stay fast. To run real curation passes, install the gated Data-Juicer engine
into the API venv:

```bash
services/api/.venv/bin/pip install -r services/api/requirements-ml.txt
```

It pulls torch + HuggingFace `datasets`. Without it, a run is recorded as
`failed` with an actionable message and the API never errors — every other
feature (recipe CRUD, dashboard, explorer, seeding) works on the base venv.

**4. Run it**

```bash
pnpm dev
```

Frontend at `localhost:3000`, API at `localhost:8000`. Open **Datasets → Seed
demo corpus** to generate a tiny synthetic corpus in `raw/`, create a recipe
under **Recipes → New recipe**, then **Run curation** and watch the refined
output and per-operator stats appear. Interactive API docs (Swagger UI) are at
`localhost:8000/docs`, ReDoc at `/redoc`.

`pnpm dev` runs the preflight check first — it catches the common setup gotchas
(wrong Node/Python version, missing venv, missing or placeholder `.env`, ports
taken). Run it standalone any time with `pnpm run doctor`.

### The curation journey

`Seed or upload raw shards → author a recipe → run it → inspect refined output + stats`

1. **Seed / upload** a corpus into `raw/` (Datasets page seeds a synthetic demo, or Upload lands your own).
2. **Author a recipe** — pick a modality and Data-Juicer operators (defaults are lightweight CPU operators, no model download).
3. **Run** — the app downloads the shards, runs Data-Juicer in an isolated subprocess, and uploads `refined/<run>/` + `stats/<run>.json`.
4. **Inspect** — Runs shows kept/filtered/dedup per operator; the dashboard aggregates raw-vs-refined storage and pass rates.

Full walkthrough: [docs/app-workflows.md](docs/app-workflows.md).

### Supported local environments

Local scripts run on macOS, Linux, and WSL2 — native Windows isn't supported
yet (the dev scripts use POSIX shell). Cloud or sandboxed agent environments
also need permission to install dependencies and bind localhost ports; see
[docs/verification.md](docs/verification.md#local-environments).

## When to use

Use this repository when you keep heterogeneous foundation-model corpora
(image-text pairs, video, audio, text) in Backblaze B2 and want to drive
reproducible cleaning from a local box: version operator chains as recipes,
run them on-device with Data-Juicer, and accumulate refined shards + stats in
B2 without a managed ETL service or a second cloud key.

## When not to use

Do not choose this repository expecting a hosted, multi-tenant curation SaaS or
a distributed cluster job runner. It runs one curation pass at a time on the
local machine, ships no authentication or tenant isolation, and provides no
managed hosting or SLA. You own the product-specific security, operations,
capacity, and compliance decisions for anything you adapt.

## Why Backblaze B2?

[Backblaze B2](https://www.backblaze.com/cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-data-juicer-multimodal-curation) is the object storage this app is built around — a deliberate default, not just a demo backend:

- **S3-compatible API.** B2 speaks the S3 API, so the `boto3` calls you already use for AWS S3 work unchanged against B2's regional endpoint. All B2 traffic is isolated in `services/api/app/repo/` with a custom user agent; nothing is locked to a proprietary client, and Data-Juicer never gets its own S3 client.
- **Built for data-heavy AI.** Curation is write-amplifying — refined shards and per-operator stats accumulate every pass — so hundreds of TB of raw + refined multimodal data is exactly what B2's low storage price and generous free egress are for.
- **Free to start.** A [free B2 account](https://www.backblaze.com/sign-up/ai-cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-data-juicer-multimodal-curation) is enough to run everything here.

## Core Features

- [Curation Recipes](docs/features/recipes.md) — CRUD + run for Data-Juicer operator chains, stored as YAML in B2 `configs/`
- [Curation Run](docs/features/curation-run.md) — stream `raw/`, clean on-device with Data-Juicer, write `refined/` + `stats/`
- [Datasets Library](docs/features/datasets-library.md) — modality-aware, prefix-scoped browse of the app's own datasets
- [Dashboard](docs/features/dashboard.md) — raw vs refined storage, samples kept/filtered, pass and dedup ratios, recent runs
- [File Browser](docs/features/file-browser.md) — full-bucket list, preview, download, delete (kept starter surface)
- [File Upload](docs/features/file-upload.md) — drag-and-drop upload straight to B2 (kept starter surface)
- [Metadata Extraction](docs/features/metadata-extraction.md) — image dimensions, EXIF, PDF info, checksums
- [Design System](docs/design-system.md) — tokens, primitives, loaders, `ErrorState` / `EmptyState`. Live preview at `/design`.
- Centralized data layer — every fetch goes through TanStack Query hooks in `apps/web/src/lib/queries.ts`
- Checked local API contract — [`docs/api/openapi.json`](docs/api/openapi.json) plus `pnpm contract:check` catch FastAPI/client route drift
- Structural tests — layering rules, import boundaries, boto3 + Data-Juicer containment, 300-line file limit
- `/health` (B2 connectivity) and `/metrics` (Prometheus counters) endpoints
- Per-IP rate limiting and magic-byte upload validation — see [SECURITY.md](docs/SECURITY.md)

## Building on this scaffold

This app is built on the vibe-coding starter kit. When you adapt it further, keep the shared scaffolding and swap what's app-specific:

- **Keep** the UI kit (`apps/web/src/components/ui/` + design tokens in `globals.css` + `/design`).
- **Keep** the full-bucket File Explorer (`/files`) and Upload (`/upload`) pages and their sidebar entries.
- **Adapt** the Dashboard (`/`) to your metrics — here it shows curation metrics rather than generic file stats.
- **Rebrand** by editing a single file: `apps/web/src/lib/app-config.ts` holds `APP_NAME` and `APP_DESCRIPTION`.

Full contract: [AGENTS.md §2 — Building on This Starter Kit](AGENTS.md#2-building-on-this-starter-kit).

## Tech Stack

- TypeScript, Next.js 16, React 19, Tailwind v4, shadcn/ui, TanStack Query
- Python 3.12+, FastAPI, boto3, Pydantic v2, PyYAML, Pillow
- [Data-Juicer](https://github.com/modelscope/data-juicer) (`py-data-juicer`) — the curation engine (gated ML dependency, runs in an isolated subprocess)
- Backblaze B2 (S3-compatible object storage)
- pnpm workspaces (monorepo)

## Commands

The commands you reach for day to day:

| Command | What it does |
|---------|-------------|
| `pnpm run setup` | One-time cold start: copy `.env.example` → `.env` (only if missing), install workspace deps, create the backend venv, install locked API deps |
| `pnpm dev` | Start frontend + backend (runs the `pnpm run doctor` preflight first) |
| `pnpm wait-ready` | Block until the running web + API answer, print one line, exit 0/1 |
| `pnpm verify` | Credential-free pre-PR suite — runs `check:agent-docs`, `verify:api`, then `verify:web` |
| `pnpm verify:full` | `pnpm verify` plus Playwright E2E; needs a live local stack, real `.env`, free port 3000, and Chromium |
| `pnpm test:verify` | Run throwaway verification specs from `apps/web/e2e/verify/` against the app |
| `pnpm contract:export` / `pnpm contract:check` | Export / verify the FastAPI OpenAPI contract in `docs/api/openapi.json` |

`pnpm verify` is the gate to run before opening a PR. It needs
`services/api/.venv` from `pnpm run setup`, but no B2 credentials or browser, and
breaks down into `pnpm verify:api` (backend lint, tests, structure),
`pnpm verify:web` (frontend lint, unit tests, typecheck + build), and
`pnpm check:agent-docs` (agent-doc drift). The credential-free gate never
installs the Data-Juicer engine, so it stays fast.

For the full command reference (`dev:web`, `dev:api`, `lint`, `test:*`,
`check:structure`, `test:e2e`, live B2 tests), see
[docs/dev-workflows.md](docs/dev-workflows.md#commands). For worktree/parallel-run
notes and slow-run recovery, see [docs/verification.md](docs/verification.md).

## Deploying to Vercel

Deploys as **one Vercel project** — the Next.js web app and FastAPI API build
from the same repo and share one origin (web at `/`, API under `/api`), so
there's **no CORS and no second URL to wire up**.

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fbackblaze-b2-samples%2Fdata-juicer-multimodal-curation&project-name=data-juicer-multimodal-curation&repository-name=data-juicer-multimodal-curation&demo-title=Data-Juicer%20Multimodal%20Curation&demo-description=Local%20B2-backed%20control%20plane%20for%20multimodal%20training-data%20curation%20with%20Data-Juicer.&env=B2_APPLICATION_KEY_ID,B2_APPLICATION_KEY,B2_REGION,B2_BUCKET_NAME&envDescription=B2%20credentials%20and%20bucket&envLink=https%3A%2F%2Fgithub.com%2Fbackblaze-b2-samples%2Fdata-juicer-multimodal-curation%2Fblob%2Fmain%2Finfra%2Fvercel%2FREADME.md)

Note: real Data-Juicer runs pull a heavy ML closure (torch) and can exceed a
serverless deploy's build/runtime limits — a Vercel deploy is best for the
recipe/dashboard/explorer UI, with curation runs driven locally or on a machine
where `requirements-ml.txt` is installed. Two things to know before a real
deploy:

- Your bucket's CORS must allow the deploy origin.
- The deployed API is unauthenticated and bucket-wide — use a dedicated B2
  bucket/prefix and key for any preview.

Full setup — variable reference, the two-Projects alternative, security,
preview/production, `/health` checks, and rollback — is in the
[Vercel delivery contract](infra/vercel/README.md).

## Documentation Map

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](AGENTS.md) | Agent table of contents — start here |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System layout, layering, data flows, Data-Juicer engine |
| [PRODUCT.md](PRODUCT.md) | Product overview and users |
| [docs/features/](docs/features/) | Feature docs (recipes, curation run, datasets, dashboard, browser, upload, metadata) |
| [docs/design-system.md](docs/design-system.md) | Design tokens, primitives, loaders, error/empty states |
| [docs/app-workflows.md](docs/app-workflows.md) | User journeys |
| [docs/dev-workflows.md](docs/dev-workflows.md) | Engineering workflows, command index, releases |
| [docs/verification.md](docs/verification.md) | What each gate checks, and failure recovery |
| [docs/frontend-conventions.md](docs/frontend-conventions.md) | Frontend conventions, screens, data fetching |
| [docs/SECURITY.md](docs/SECURITY.md) | Security principles |
| [docs/RELIABILITY.md](docs/RELIABILITY.md) | Reliability expectations |
| [docs/api/openapi.json](docs/api/openapi.json) | Checked contract for the local FastAPI API |
| [infra/vercel/README.md](infra/vercel/README.md) | Vercel deployment contract |
| [docs/exec-plans/](docs/exec-plans/) | Execution plans and tech debt tracker |

## FAQ

**What is Data-Juicer Multimodal Curation?**
A local, full-stack app (Next.js 16 + FastAPI) that curates multimodal
training data with [Data-Juicer](https://github.com/modelscope/data-juicer),
using [Backblaze B2](https://www.backblaze.com/cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-data-juicer-multimodal-curation) as the sole store
for raw corpora, recipes, refined output, and run stats.

**How does a curation run work?**
You author a recipe (a Data-Juicer operator chain). On run, the app streams the
source shards from B2 `raw/`, runs Data-Juicer locally in an isolated
subprocess, and uploads the refined dataset to `refined/<run>/` and per-operator
stats to `stats/<run>.json`. All B2 access goes through one custom-UA boto3
client in the repo layer.

**Do I need a GPU?**
No. Runs default to CPU and auto-detect the first available of CUDA → Apple MPS
→ CPU. The default recipe uses only lightweight CPU operators (text + PIL/image
filters) — no model download. Model-backed operators are flagged in the catalog
and off by default. Data-Juicer's ML operators fall back CUDA → CPU where MPS
support is weak.

**Is it free?**
Yes. The code is MIT-licensed (see [License](#license)), Data-Juicer is
open-source, and Backblaze B2 offers a free account. A curation run costs $0
beyond B2 storage — there is no external AI provider.

**Can I use it in production?**
It's a sample Backblaze maintains to help developers get started with B2.
Production use is possible with caution and your own validation — you own the
security, operations, capacity, and compliance decisions. See
[When not to use](#when-not-to-use) and [Maintenance and support](#maintenance-and-support).

**Do I have to use Backblaze B2?**
It integrates B2 through the S3-compatible API, and B2 is the storage the app is
built around. You supply your own B2 bucket and application key during setup.

**What's the tech stack?**
Frontend: TypeScript, Next.js 16, React 19, Tailwind v4, shadcn/ui, TanStack
Query. Backend: Python 3.12+, FastAPI, boto3, Pydantic v2. Engine: Data-Juicer.
Storage: Backblaze B2 (S3-compatible). See [Tech Stack](#tech-stack).

**Where do I get help or report bugs?**
Report repository defects through [GitHub Issues](https://github.com/backblaze-b2-samples/data-juicer-multimodal-curation/issues). For B2 account, billing, service, or API help, use [Backblaze Support](https://www.backblaze.com/help).

## Maintenance and support

Backblaze maintains this open-source sample to help developers get started with
B2. Production use is possible with caution and requires your own validation.
Report repository defects and feature requests through
[GitHub Issues](https://github.com/backblaze-b2-samples/data-juicer-multimodal-curation/issues);
for B2 account, billing, service, or API help, use
[Backblaze Support](https://www.backblaze.com/help). This sample is not covered
by the Backblaze service level agreement, and no SLA is provided for the
repository software; any B2 service or support commitments are governed
separately by the applicable Backblaze terms and support plan.

## Contributing

Start with [AGENTS.md](AGENTS.md). It's the map — everything else is discoverable
from there. For local commit hooks, follow [the pre-commit workflow](docs/verification.md#pre-commit).

## License

MIT License - see [LICENSE](LICENSE) for details.

## Related projects

**Claude Agent B2 Skill** — manage Backblaze B2 from your terminal using natural language. Repo: [claude-skill-b2-cloud-storage](https://github.com/backblaze-b2-samples/claude-skill-b2-cloud-storage).
