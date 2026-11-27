# Lyrie — Lyrics to PDF Converter

Lyrie is a private, browser-based utility that turns user-provided song lyrics into clean, printable PDFs. Lyrics stay in browser memory; the application has no backend, lyrics API, account, database, or persistence.

## Current status

Phases 1–6 are complete (6/7 phases, 92%); Phase 7 release validation is in progress. The browser PDF generator supports nine standard paper sizes and validated custom portrait dimensions, wraps repeated headers, lays out lyrics in two equal columns, and loads script-appropriate Noto CJK or Roboto faces on demand. The responsive workspace collects title, artist, lyrics, and paper settings; validates input; and generates a real PDF snapshot. PDF.js renders the retained PDF snapshot as a page canvas with a selectable text layer. Users can navigate pages, zoom from 50% to 200%, fit the page or width, enter fullscreen, and download the exact previewed bytes. PDF.js and its worker load only when a snapshot needs previewing.

The editor includes standard paper presets and custom dimensions in millimeters or inches. Lyrics and form data remain in memory only. Invalid input and recoverable generation errors preserve the user's text. See the roadmap for Phase 7 release work and the implementation log for browser and production-build evidence.

## Technology

React, Vite, strict TypeScript, Tailwind CSS 4, pdfmake, PDF.js (`pdfjs-dist`), Lucide React, Manrope Variable, Vitest, Playwright and ESLint. The npm lockfile preserves resolved dependency versions.

## Requirements

- Node.js 22.13 or newer and npm are required (`Node.js 26.12.1`, npm 11.20.0 were used for this release review).
- Install exact locked dependencies: `npm ci --cache .npm-cache`
- Install the matching Playwright Chromium browser once: `npm run test:e2e:install`
- Install Firefox and WebKit for the optional browser matrix: `npm run test:e2e:install:matrix`

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
| `npm run test:e2e:matrix` | Run the isolated generation/preview/download matrix in Chromium, Firefox and WebKit. |

## Documentation

- [Future-agent instructions](AGENTS.md)
- [Seven-phase roadmap](docs/IMPLEMENTATION_PLAN.md)
- [Working product specification](docs/PROJECT_SPECIFICATION.md)
- [Technical decisions and evidence](docs/TECHNICAL_DECISIONS.md)
- [Chronological implementation log](docs/IMPLEMENTATION_LOG.md)
- [Third-party notices](docs/THIRD_PARTY_NOTICES.md)
- [Original authoritative specification](Lyrics_to_PDF_Complete_Product_and_Implementation_Specification.pdf)

## Privacy and current limits

Processing is pure TypeScript and keeps lyrics in memory; it removes only explicit Genius URL lines, preserves ambiguous text, and does not fetch lyrics. PDF output uses embedded Roboto for Latin/Filipino text and on-demand Noto Sans CJK faces for Korean, Japanese, Simplified Chinese and Traditional Chinese. Shared Han-only text defaults to Japanese; canonical-equivalent combining sequences may be composed by PDF font shaping/extraction. Manrope is used for interface text. Aptos redistribution and embedding rights remain unresolved, and no Aptos font file is included. Font notices are in `docs/THIRD_PARTY_NOTICES.md` and copied to `public/licenses/`.

The viewer renders one PDF page at a time and retains the PDF.js document only while its snapshot is active. Preview uses a bounded canvas (maximum 16 million pixels and 8192 pixels per side), browser-memory bytes, and a temporary download object URL. The Lyrie interface uses the approved logo and browser icon. Latest local verification includes 260 unit tests, 24 Chromium E2E tests, Chromium/Firefox/WebKit development and production-artifact workflows under the configured security headers, and an npm audit with zero vulnerabilities. The user reports successfully completing the manual Windows Narrator accessibility checklist; this is not a comprehensive WCAG 2.2 AA conformance claim. The authoritative deployed-browser smoke test remains outstanding.

See [the release checklist](docs/RELEASE_CHECKLIST.md) for current evidence and remaining release gates. `vercel.json` prepares a static Vite build in `dist/` and sets security headers; no deployment has been made. See `docs/TECHNICAL_DECISIONS.md` for font findings and `docs/PROJECT_SPECIFICATION.md` for the complete product baseline.
