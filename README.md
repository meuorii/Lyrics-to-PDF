# Lyrics to PDF

A client-side foundation for a focused utility that formats user-provided song lyrics as printable documents. Lyrics stay in browser memory; the application has no backend, lyrics API, account, database, or persistence.

## Current status

Phases 1–4 — Technical Foundation & Feasibility, Lyrics Processing & Validation Engine, Core PDF Generation Engine, and Advanced Pagination & Multilingual Support — are complete (4/7 phases, 60%). The browser PDF generator supports the nine standard sizes and validated custom portrait paper, dynamically wraps repeated headers, lays out lyrics in two equal columns, and embeds script-appropriate Noto CJK or Roboto faces on demand. The production editor, preview controls and download workflow remain for later phases.

## Technology

React, Vite, strict TypeScript, Tailwind CSS 4, pdfmake, PDF.js (`pdfjs-dist`), Lucide React, Manrope Variable, Vitest, Playwright and ESLint. The npm lockfile preserves resolved dependency versions.

## Requirements

- Node.js 26.12.1 and npm 11 were used for Phase 1.
- Install package dependencies: `npm install --cache .npm-cache`
- Install the matching Playwright Chromium browser once: `npm run test:e2e:install`

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Run strict type checks and create a production build in `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | Lint application, tests and project configuration. |
| `npm run typecheck` | Check application, tests and configuration types. |
| `npm run test` | Run deterministic Vitest unit/PDF tests. |
| `npm run test:e2e` | Start a local Vite server, run Playwright Chromium, then stop the server. |

## Documentation

- [Future-agent instructions](AGENTS.md)
- [Seven-phase roadmap](docs/IMPLEMENTATION_PLAN.md)
- [Working product specification](docs/PROJECT_SPECIFICATION.md)
- [Technical decisions and evidence](docs/TECHNICAL_DECISIONS.md)
- [Chronological implementation log](docs/IMPLEMENTATION_LOG.md)
- [Third-party notices](docs/THIRD_PARTY_NOTICES.md)
- [Original authoritative specification](Lyrics_to_PDF_Complete_Product_and_Implementation_Specification.pdf)

## Privacy and current limits

The feasibility action generates a synthetic sample in the browser. Processing is pure TypeScript and keeps lyrics in memory; it removes only explicit Genius URL lines, preserves ambiguous text, and does not fetch lyrics. PDF output uses embedded Roboto for Latin/Filipino text and on-demand Noto Sans CJK faces for Korean, Japanese, Simplified Chinese and Traditional Chinese. Shared Han-only text defaults to Japanese; canonical-equivalent combining sequences may be composed by PDF font shaping/extraction. Manrope is used for interface text. Aptos redistribution and embedding rights remain unresolved, and no Aptos font file is included. Font notices are in `docs/THIRD_PARTY_NOTICES.md` and copied to `public/licenses/`.

See `docs/TECHNICAL_DECISIONS.md` for font findings and `docs/PROJECT_SPECIFICATION.md` for the complete product baseline.
