# Phase 7 release checklist

**Review date:** 27 November 2026
**Status:** Release validation in progress. The project accessibility checklist is complete (manual Narrator evidence is user-reported); the deployed-browser smoke test remains open. This does not assert comprehensive WCAG 2.2 AA conformance.
**Authority:** `Lyrics_to_PDF_Complete_Product_and_Implementation_Specification.pdf`, reviewed in full (14 pages). Page 14 requires all P0 release gates to pass before the project can be called complete.

## Functional requirements (source pp. 3–4, 9–11)

## Lyrie branding milestone

| Criterion | Evidence | Result |
|---|---|---|
| Official logo, accessible home link, responsive off-white masthead, approved H1 and description | `src/App.tsx`, `src/styles.css`, branding E2E regression at 320–1440 px | PASS |
| SVG/PNG browser icons and Lyrie title/application/description/Open Graph metadata | `index.html`, dev and production-preview E2E asset response and metadata assertions | PASS |
| Generated PDF remains unbranded and functional behavior is preserved | Full 260-test unit and 24-test workspace/E2E suites; no PDF source changes in this milestone | PASS |


| ID | Priority | Evidence | Result |
|---|---|---|---|
| FR-01 Metadata | P0 | `tests/e2e/workspace.spec.ts`: required fields, preserved values, validation; no lyric URL path exists. | PASS |
| FR-02 Lyrics editor | P0 | Unit normalization/preservation tests and real browser input/generation. | PASS |
| FR-03 Paper | P0 | `tests/e2e/app-shell.spec.ts` and `workspace.spec.ts`: nine presets, custom dimensions, mm/in conversion, unusable geometry. | PASS |
| FR-04 Section labels | P0 | Independent 48-name expected list, registry/alias/number/annotation parameterized cases in `tests/unit/lyrics-processing.test.ts`, plus all 48 headings extracted from a synthetic Long Bond PDF. | PASS |
| FR-05 Spacing | P0 | Normalization and generation fixtures cover line endings, outer blanks, stanza breaks, section spacing and no extra paragraph gap. | PASS |
| FR-06 PDF layout | P0 | PDF unit/fixture suite plus browser continuation and CJK checks cover geometry, two-column flow, repeated headers, fixed type sizes and order. | PASS for tested fixtures |
| FR-07 Preview | P0 | Final 24 Chromium E2E tests and Chromium/Firefox/WebKit matrices against development and the header-enforced production artifact pass; exact Family input also previews from the production build in Chromium and Brave. | PASS for verified workflows |
| FR-08 Download | P0 | Cross-browser matrix verifies same-byte download; exact Family production-preview bytes match the download in Chromium and Brave. | PASS for verified workflows |
| FR-09 Edit/regenerate | P0 | Workspace E2E verifies stale feedback, blocked stale download, regeneration and reset. | PASS |
| FR-10 Feedback | P0 | E2E covers empty, invalid, generating, ready, stale, recoverable error and reset; in-flight reset invalidates old output. | PASS |
| FR-11 Responsive access | P0 | User reports successful completion of the previously provided manual accessibility checklist using Windows Narrator. Fresh Chromium E2E checks cover validation semantics, 320/375/768/1024/1280/1440 px layout, keyboard names, reduced motion, primary text/input-boundary contrast, and fullscreen focus behavior. | PASS for the defined project checklist; comprehensive WCAG conformance not claimed |
| FR-12 Fullscreen | P1 | Chromium verifies native fullscreen and CSS fallback, forward/reverse focus wrapping, Escape exit, and focus restoration. | PASS for verified behavior |

## Verification matrix (source p. 13)

| Test | Evidence | Result |
|---|---|---|
| T01 | Parser fixtures independently assert all 48 canonical labels, aliases, overlap resolution, numbers, annotation kinds/removal, bounded multiline cases, and negative preservation. | PASS |
| T02 | Unicode, unknown bracketed text, punctuation, repeats and stanza preservation fixtures. | PASS |
| T03 | BOM/CRLF/blank-line normalization and artifact-boundary fixtures. | PASS |
| T04 | All specified A/B/ANSI presets, mm/in and custom portrait geometry. | PASS |
| T05 | Short PDF page count and bounds checks. | PASS |
| T06 | Long fixture order, left/right/next-page flow, section continuity and no terminal blank page. | PASS |
| T07 | Repeated dynamic headers, size/coordinate bounds and 12 pt body fixtures. | PASS |
| T08 | Keep-label-with-first-line, boundary separator and wrapped long-line tests. | PASS |
| T09 | Embedded-font, extracted-text, mixed-script and rendered Korean/Japanese/Simplified/Traditional Chinese plus Latin checks. | PASS for documented script set; not universal Unicode coverage |
| T10 | Actual-entry workflows verify preview/navigation/download bytes in Chromium, Firefox and WebKit; exact Family production-preview workflow also verifies identical download bytes in Chromium and Brave. The separate Ikaw source remains unavailable. | PASS for available inputs |
| T11 | Invalid input, generation recovery, preview render recovery, stale protection, three generate/reset cycles with preview-canvas removal, in-flight reset cancellation, and concurrent font-load recovery. Duplicate generation is guarded synchronously in the app. | PASS for tested workflows |
| T12 | User-reported Windows Narrator checklist pass; automated responsive widths, keyboard naming/focus, fullscreen Tab/Shift+Tab wrapping, Escape/focus restoration, validation and status checks. | PASS for the listed checklist; not a comprehensive WCAG audit |
| T13 | Final run: 260 unit tests, 23 Chromium E2E tests, development and production-artifact Chromium/Firefox/WebKit control matrices (6 each), locked install, audit, lint, typecheck and build. Local production headers were enforced; the deployed-browser gate remains open. | PARTIAL |

## Page 14 release gates

| Gate | Evidence | Result |
|---|---|---|
| Product | FR-01–FR-10 and T01–T10 evidence above; no fixed page-count cap. A 1,000-line synthetic input rendered as 26 pages with first/last markers present. | PASS for tested limits |
| Document | Real PDF fixtures verify geometry, selectable text, fonts, order and pagination; no clipping, extra pages or missing supported-script glyphs observed. | PASS for tested fixtures |
| Preview/export | Same generated bytes drive preview and download in the three-browser matrix; the exact Family input passes production-preview verification in Chromium and Brave. No exact Ikaw input was available. | PASS for available workflows |
| Design/accessibility | The automated accessibility checks pass, and the user reports all previously provided manual checklist items passed with Windows Narrator. This satisfies the project's defined checklist. No comprehensive criterion-by-criterion WCAG 2.2 AA conformance claim is made. | PASS for the defined project checklist |
| Engineering | Fresh `npm ci --cache .npm-cache`, typecheck, lint, 260/260 unit tests, 23/23 Chromium E2E tests, development and production-artifact browser-control matrices (6/6 each), `npm audit` (0 vulnerabilities), and build pass. Vite's >500 kB advisory remains. | PASS for local tested scope |
| Privacy/licensing | Browser test observed no external requests or local/session storage entries. Manrope, Roboto and Noto Sans CJK OFL notices are present; all eight Noto CJK SHA-256 hashes and byte sizes match the notice. Aptos remains excluded because redistribution/embedding rights are unverified; the specification calls it preferred and allows a licensed fallback. | PASS |
| Deployment | `vercel.json` selects the Vite framework, `npm run build`, `dist`, and restrictive same-origin/security headers. A local static host enforced those headers and the built artifact passed the three-browser preview/download matrix. Page 14 still requires worker/font/download verification in a deployed browser; public deployment was not authorized and no deployed smoke test was run. | PARTIAL — mandatory live gate open |
| Documentation | Setup, commands, supported sizes, font behavior, limits and current release gaps are documented in the README, project specification, technical decisions, implementation log and this checklist. | PASS |

## Accessibility evidence and WCAG scope

**Manual evidence (user-performed):** On 27 November 2026, the user reported testing the application with Windows Narrator and successfully completing all previously provided manual accessibility checklist items. Codex did not operate Narrator or hear/observe this session; this result is explicitly attributed to the user.

**Fresh independent automated checks:** `npm run test:e2e -- tests/e2e/workspace.spec.ts --grep "workspace labels required fields|workspace stacks|keyboard controls"` passed 3/3. `npm run test:e2e -- tests/e2e/preview.spec.ts --grep "CSS fullscreen fallback|native fullscreen"` passed 2/2. These cover field labels and validation feedback, responsive layout, keyboard control names/focus, primary button text contrast (minimum 4.5:1), input boundary contrast (minimum 3:1), reduced-motion behavior, fallback Tab/Shift+Tab focus containment, Escape exit, native fullscreen exit, and focus restoration.

| WCAG 2.2 criterion | Evidence in this application | Scope/result |
|---|---|---|
| 1.3.1 Info and Relationships (A) | Native labels, fieldsets, headings, and validation relationships; targeted browser validation test. | PASS for tested editor flows |
| 2.1.1 Keyboard (A) / 2.1.2 No Keyboard Trap (A) | Keyboard-only control navigation; fallback fullscreen focus containment and Escape exit; user-reported Narrator checklist. | PASS for tested/manual checklist scope |
| 2.4.3 Focus Order (A) / 2.4.6 Headings and Labels (AA) | Keyboard navigation, named controls, form labels, and fullscreen focus restoration. | PASS for tested/manual checklist scope |
| 2.4.7 Focus Visible (AA) / 2.4.11 Focus Not Obscured (Minimum) (AA) | Visible 3 px focus outline in the interface styles; focus assertions and user-reported checklist. | Verified for exercised paths; not exhaustively measured across every state/viewport |
| 1.4.3 Contrast (Minimum) (AA) / 1.4.11 Non-text Contrast (AA) | Automated sample checks require 4.5:1 for primary button text and 3:1 for the title input boundary; user-reported manual checklist. | Samples pass; not every text/component/state pair was exhaustively calculated |
| 1.4.10 Reflow (AA) | Chromium checks responsive layout at 320 CSS px and wider with no horizontal document overflow; user-reported checklist. | PASS for tested viewport widths |
| 3.3.1 Error Identification (A) / 3.3.2 Labels or Instructions (A) | Required labels, validation summary/field feedback, and input preservation are exercised by E2E. | PASS for tested validation flows |
| 4.1.2 Name, Role, Value (A) / 4.1.3 Status Messages (AA) | Named controls and semantic alert/status/live-region markup; automated validation, generation, stale, and recovery flows plus user-reported Narrator checklist. | PASS for tested workflows |

This evidence supports the project's accessibility checklist; it is not a complete audit of every applicable WCAG 2.2 A/AA success criterion and is not a conformance certification. The project accessibility gate is marked passed for its defined scope without making that broader claim.

## Browser and performance observations

- Browser matrix: Chromium 159.0.8154.6, Firefox 159.0, WebKit 27.2. All passed the same 151,379-byte multilingual PDF generation/preview/navigation/download workflow in development and in the built production preview.
- Isolated Chromium performance run: 1,000 synthetic lyric lines produced 26 pages; generation plus initial preview took 9,241 ms and `performance.memory.usedJSHeapSize` reported 60,300,000 bytes. The full parallel Chromium suite measured 20,337 ms and 68,000,000 bytes for the same stress input, showing substantial host-load sensitivity. These are observations, not product performance budgets.
- Mixed-script fixture: 2 pages, 151,840 bytes; observed cold/warm generation was 10,971/2,326 ms in the final full-suite run and browser JS heap was 212,000,000 bytes. Font assets account for much of this memory and load only when the script is needed.
- **Prior production measurement (2026-11-26):** 51,590,945 bytes across 27 files. The eight on-demand Noto CJK font files total 47,048,112 bytes. Main JS was 259.38 kB (81.23 kB gzip); generator JS was 2,096.71 kB (948.27 kB gzip); PDF.js runtime was 500.39 kB (153.01 kB gzip); worker was 1,327.59 kB. The final build figures below supersede these asset sizes. Vite emits its >500 kB chunk advisory. Large PDF/font assets are lazy or script-specific, but a hard performance budget has not been set.
- **Fresh final run (2026-11-27):** 1,000 synthetic lines generated and traversed as 26 pages in 21,444 ms under the parallel Chromium suite; reported browser heap was 64 MB. The mixed-script regression generated a two-page, 151,840-byte PDF; observed cold/warm generation was 6,698/1,703 ms and browser heap was 167 MB. These timings vary with host load and are observations, not budgets.
- **Current production artifact:** 27 files, 51,595,048 bytes; main JS 263.01 kB (82.26 kB gzip), generator JS 2,097.18 kB (948.41 kB gzip), PDF.js runtime 500.39 kB (153.01 kB gzip), worker 1,327.59 kB. Vite's >500 kB advisory remains. All eight Noto CJK files in `dist` match the recorded byte sizes and SHA-256 hashes.
- No explicit maximum lyric character count or fixed page-count cap is imposed. Browser resource exhaustion for arbitrarily large input is not guaranteed to recover gracefully; validate in a browser with realistic content limits.

## Reopened PDF pagination release blocker — resolved for available inputs

- **Original failure:** Exact local input processed successfully, but generation raised `PdfGenerationError` with code `inspection-failed` at page-count inspection (planned 1 page, actual 2). This was a planned/actual page-count mismatch rather than a lower-level thrown exception. The original input was read only; its text is excluded from diagnostics and reports. Four U+2005 spaces are present; replacing them had not changed the original failure, and the corrected pipeline succeeds with them retained.
- **Confirmed cause and refinement:** The initial failure came from reserving only glyph-box height while pdfmake's line-fit check uses font ascender/descender height (Roboto, 12 pt: 14.0625 pt). A first fix added renderer-safe fit height. Follow-up found that accumulating this reservation as cursor advancement was unnecessarily conservative; pagination now advances by visual `heightPt` and checks each proposed renderer extent at its visual position. Atomic section-start groups check every heading/first-line extent sequentially. Strict page-count inspection remains enabled.
- **Regression and exact engine evidence:** The anonymized Legal boundary fixture remains a permanent regression. Unit pagination tests fail under cumulative-reservation semantics and pass with visual cursor advancement and per-line renderer-fit checks. Exact input processing succeeds (3,615 UTF-16 units; 17 normalized sections); exact `generatePdf()` now yields one Legal page at 612 × 1008 pt. PDF.js extraction, after whitespace/NFC normalization, matches all processed lyric text; annotations normalize to canonical labels; snapshot Blob bytes equal snapshot bytes. Poppler raster inspection shows two-column output with the first column ending 20.45 pt above the 15 mm bottom margin; no clipping was observed. This is engine/PDF verification, not browser preview/download verification.
- **Section-label refinement:** The parser now canonicalizes supported headings, preserves verse digits, recognizes Medley and removes only supported balanced song-reference/performer annotations. It recognizes only clear, one-line annotation continuations; ambiguous/malformed multiline text remains unchanged. Synthetic tests cover the parser and actual PDF extraction without embedding the original lyrics.
- **Browser evidence after refinements:** An unprivileged loopback probe returned `EACCES`; the requested scoped local permission enabled the existing Playwright infrastructure. `npm run test:e2e` passed 22 Chromium tests and `npm run test:e2e:matrix` passed Chromium, Firefox and WebKit. Exact Family input passed the built production preview, PDF text checks, and same-byte download in Chromium and Brave. No exact Ikaw raw input is present; its browser result is not claimed.

## Comprehensive section-label normalization

- **Confirmed Rap defect:** `parseSectionLabel('[Rap: …]')` returned `null` because Rap and the other new types were absent from the previous fixed list. Normalization consequently treated annotated headings as lyric lines and could not apply structured section-start placement. No artist lookup or global performer removal is appropriate.
- **Implementation and regression evidence:** `SECTION_REGISTRY` now defines all 48 approved canonical types, aliases, and shared optional-decimal numbering. Tests assert the expected list independently, all names/aliases/numbers, longest-name matching, shared song-reference/performer removal, canonical output, and malformed/unknown preservation. A synthetic Long Bond PDF includes all 48 numbered headings with both annotation forms; PDF.js verifies canonical text and full ordered lyric extraction, metadata, 612 × 936 pt pages, page-count agreement, and snapshot Blob byte equality. The two rendered pages were visually inspected.
- **Family exact input:** The existing `tmp/repro-lyrics.txt` was read only and left unchanged. It still normalizes to 17 sections and produces a one-page Legal PDF (612 × 1008 pt); PDF.js extraction matches all normalized text and snapshot bytes. Poppler visual inspection found no clipping or unexpected blank page.
- **Ikaw exact input:** Not available in the workspace. No external lyrics were retrieved. Synthetic Rap/numbered Rap Verse tests, a 110-line Rap and Hook flow test, a column-boundary Rap case, and a production-editor Playwright test were added; no exact-input result is claimed.
- **Preserved behavior:** Pagination, text metrics, and PDF generation engines were not changed for this refinement. Tests cover Rap section-start placement, numbered Rap Verse page-boundary placement, Spoken Word via the 48-label PDF set, long Rap/Hook continuation, standalone Instrumental Break, strict page inspection, and previous renderer-fit safety.

## Browser evidence for section normalization

- The permanent synthetic editor E2E test verifies annotated numbered Rap Verse and Spoken-Word labels through preview while retaining synthetic lyrics and artist metadata.
- A temporary Playwright test used `tmp/repro-lyrics.txt` only in memory, verified the Family Legal preview and canonical Chorus/Medley headings in the built production app, then compared the PDF.js transferred bytes with the browser download. It passed in Chromium and Brave; the temporary test/config and generated PDFs were removed.

## Commands and deployment boundary

| Command | Result |
|---|---|
| `npm ci --cache .npm-cache` | PASS, fresh locked install (262 packages) |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS, 260 tests / 13 files |
| `npm run test:e2e` | PASS, 23 Chromium tests |
| `npm run test:e2e:matrix` | PASS, Chromium/Firefox/WebKit, 6 browser-control cases |
| Production-artifact matrix | PASS, Chromium/Firefox/WebKit, 6 cases against `dist` with Vercel-equivalent headers |
| `npm run build` | PASS; Vite >500 kB chunk advisory remains |
| `npm audit` | PASS, 0 vulnerabilities |

**Final verification (2026-11-27):** Fresh locked installation, `npm run typecheck`, `npm run lint`, `npm run test` (260/260; 13 files), `npm run test:e2e` (23/23 Chromium), `npm run test:e2e:matrix` (6/6 development browser-control cases), `npm run build`, and `npm audit` (0 vulnerabilities) pass. A local header-aware static host applied the configured CSP and security headers to `dist`; Chromium, Firefox and WebKit each generated, previewed, navigated, zoomed, fit pages, wrapped fullscreen focus, exited with Escape/focus restoration, loaded multilingual fonts, and downloaded identical bytes (6/6 production cases). Exact Family production-preview verification in Chromium and Brave remains recorded in the preceding section/log. The early non-elevated loopback timeout and initial incorrect Playwright cache selection were followed by successful runs with the authorized existing browser cache and scoped localhost permission. Vite's existing >500 kB chunk advisory remains.

**Open mandatory gate:** The authoritative page 14 deployment gate requires worker/font paths and exact-byte download to be checked in a deployed browser; only a local static build was verified. Public deployment was explicitly not authorized. Keep Phase 7 IN PROGRESS at 92% until deployment is authorized, performed through the approved path, and smoke-tested. The project accessibility checklist is passed as described above; do not present it as comprehensive WCAG conformance.

Local production preview is not a Vercel deployment. Do not mark Phase 7 complete until, after deployment is authorized and available, the deployed asset and exact-byte download smoke test is recorded.
