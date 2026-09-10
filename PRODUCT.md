# Product

## Register

product

## Users

AI researchers and dataset engineers who clean heterogeneous foundation-model corpora —
image-text pairs, video, audio, and text — that live in Backblaze B2. Their context:
hundreds of TB of raw + refined multimodal data on B2, driven from a local box, with
write amplification (refined shards + stats accumulating per pass) making B2 the natural
home. They want reproducible, versioned cleaning (recipes) run on their own hardware
with no managed cloud ETL and no second API key.

## Product Purpose

A local, B2-backed control plane for multimodal training-data curation, built on the
[Data-Juicer](https://github.com/modelscope/data-juicer) engine (Next.js 16 + React 19 +
Tailwind v4 + shadcn/ui frontend, FastAPI backend). Users author a Data-Juicer recipe
(a composable operator chain — dedup, length/quality filters, resolution/aspect checks),
store it as YAML in B2 `configs/`, then run it: the app streams raw shards from B2 `raw/`,
applies the operators locally with Data-Juicer, and writes the refined dataset to
`refined/` and per-operator stats to `stats/`. Success = a lab can keep its whole corpus
on B2 and drive reproducible curation from a laptop, with every run's kept/filtered/dedup
outcome recorded. Cost per run is $0 beyond B2 storage — there is no external AI provider.

## Maturity and Support Boundary

This is a maintained open-source template/sample, not a complete hosted SaaS product.
It is built with production-minded controls and can be adapted for production use with
caution, but adopters own product-specific validation, security, deployment, and
operations. Repository defects and feature requests go through the public GitHub issue
tracker; B2 account, billing, service, and API questions go through Backblaze Support.
The template/sample itself is not covered by the Backblaze service level agreement,
and no SLA is provided for the repository software.

## Brand Personality

Confident, precise, quietly professional. Voice is direct and free of hype ("Stop
wiring boilerplate and start building"). The interface should feel like a modern
developer tool — considered, calm, trustworthy — not a marketing showpiece. It is a
**neutral foundation** that others rebrand: the design carries craft through restraint,
not through a strong opinionated identity of its own.

## Anti-references

- **Generic AI/SaaS slop.** No gradient text, hero-metric templates, identical
  icon-card grids, tracked uppercase eyebrows, or decorative glassmorphism. These are
  the exact 2026 AI tells this kit exists to help builders avoid.
- **Over-branded / loud.** No heavy brand-color drenching, decorative motion, or flashy
  effects. It is scaffolding to be rebranded, not a hero page.
- **Toy / prototype feel.** No missing states, inconsistent components, or placeholder
  polish. Must read as polished, dependable scaffolding.
- **Enterprise-drab.** No Bootstrap-era gray boxes or dense-but-lifeless admin-panel
  look. Considered, like modern dev tools (Linear, GitHub Primer, Stripe).

## Design Principles

- **Practice what you preach.** The kit itself must model the engineering quality it
  asks agents to produce. Slop here propagates into every project built on it.
- **Neutral foundation, easy to rebrand.** Identity lives in tokens (`globals.css`) and
  one config file. Screens are built from the shared UI kit so a rebrand is a token
  swap, not a rewrite.
- **Earned familiarity over novelty.** Use standard, trusted affordances (top bar +
  side nav, command palette, data tables). The tool disappears into the task.
- **Every state is designed.** Default, hover, focus, active, disabled, loading (skeleton),
  empty (teaches the interface), and error (says what's wrong + offers retry) — never
  half-shipped.
- **Consistency is the feature.** One button vocabulary, one form-control set, one icon
  style across every screen. Divergence is a bug.

## Accessibility & Inclusion

Target **WCAG 2.1 AA**. Body text ≥ 4.5:1, large/bold text ≥ 3:1, visible focus
indicators on every interactive element, full keyboard navigation, correct semantic
landmarks and heading order, labelled form controls, and a `prefers-reduced-motion`
alternative for every animation. Full light and dark theme parity.
