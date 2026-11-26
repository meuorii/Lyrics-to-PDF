# Lyrics to PDF

A client-side foundation for a focused utility that formats user-provided song lyrics as printable documents. Lyrics stay in browser memory; the application has no backend, lyrics API, account, database, or persistence.

## Current status

Phases 1–3 — Technical Foundation & Feasibility, Lyrics Processing & Validation Engine, and Core PDF Generation Engine — are complete (3/7 phases, 44%). The repository contains pure lyrics normalization/validation, paper dimension resolution, and a browser PDF generator that returns a byte snapshot and Blob for registered and custom portrait paper sizes. Its embedded Roboto font safely rejects unsupported glyphs; multilingual fallback and pagination hardening are Phase 4. The production editor, preview controls and download workflow remain for later phases.

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

The feasibility action generates a synthetic sample in the browser. Phase 2 processing is pure TypeScript and keeps lyrics in memory; it removes only explicit Genius URL lines and preserves ambiguous text. It does not scrape or fetch lyrics. The prototype uses pdfmake’s bundled Roboto font for Latin text only; it is not the final approved PDF font and does not cover Hangul/CJK. Manrope is used for interface text. Aptos redistribution and embedding rights remain unresolved, and no Aptos font file is included. Font notices are in `docs/THIRD_PARTY_NOTICES.md` and copied to `public/licenses/`. Production PDF rendering still supports only the Phase 1 A4 prototype; Phase 2 paper presets are data and validation only.

See `docs/TECHNICAL_DECISIONS.md` for font findings and `docs/PROJECT_SPECIFICATION.md` for the complete product baseline.
