# Lyrics to PDF — Seven-Phase Implementation Roadmap

The original 14-page specification is authoritative. The percentages total 100%. Phases 1–6 are complete; Phase 7 release validation is in progress.

## Progress

- Completed phases: 6 / 7
- Weighted implementation progress: 92%
- Completed phases: Phase 1 — Technical Foundation & Feasibility; Phase 2 — Lyrics Processing & Validation Engine; Phase 3 — Core PDF Generation Engine; Phase 4 — Advanced Pagination & Multilingual Support; Phase 5 — UI/UX & Design System; Phase 6 — PDF Preview, Download & Integration
- Current phase: Phase 7 — Refinement, Testing & Release Readiness — IN PROGRESS (92% weighted implementation remains until its release gates pass)

## Phase 1 — Technical Foundation & Feasibility (12%)

**Objective:** Establish a reproducible React/Vite/TypeScript client-only project, typed boundaries, editorial tokens, and an executable PDF prototype that proves the critical layout/library assumptions.

**Scope:** Project tooling; strict domain types; minimal shell; centralized A4/portrait layout contract; actual pdfmake bytes; A4 and multi-page inspection; sequential columns; repeated metadata header; PDF.js extraction and browser smoke test; Aptos and CJK font investigation; required project documentation.

**Skills:** `using-superpowers`, `brainstorming` (the request fixed the choices and explicitly directed immediate execution), `writing-plans`, `domain-modeling`, `ponytail`, `find-skills`, `pdf`, `test-driven-development`, `verification-before-completion`.

**Dependencies:** Original project PDF; Node/npm; local package access.

**Acceptance criteria:** strict typecheck, lint, unit tests, browser smoke test and production build pass; synthetic PDF bytes are valid/selectable; A4 single- and multi-page behavior, ordered native snaking columns and repeated headers are inspected; font rights/coverage findings and limitations are recorded; client-only data path is confirmed.

**Out of scope:** Lyrics normalization and production validation; complete production editor; all paper presets/custom sizing; exhaustive page-boundary handling; comprehensive CJK font fallback; production preview controls/download UX; deployment.

**Completion checklist:**

- [x] Initialize compatible stack and lockfile.
- [x] Review the complete source PDF and record page references.
- [x] Define domain contracts, application shell and design tokens.
- [x] Generate and inspect real synthetic PDF output.
- [x] Verify final automated checks, review the workspace file inventory and document evidence/limitations.

**Status:** COMPLETE.

## Phase 2 — Lyrics Processing & Validation Engine (12%)

**Objective:** Implement deterministic, conservative input validation and lyrics normalization as pure TypeScript functions.

**Scope:** Pure title/artist/lyrics validation and unified generation-input processing; normalize line endings/BOM and whitespace; recognize only complete supported section labels and remove performer suffixes from those labels; preserve unknown content and Unicode; conservatively remove explicit Genius URL lines; define standard paper presets and custom dimensions in mm/in; convert measurements and validate portrait geometry against the approved two-column layout. `processSongInput` returns generation-ready normalized content only on full validation success.

**Skills:** `using-superpowers`, `brainstorming` (the user supplied a complete implementation brief and directed immediate execution), `writing-plans`, `domain-modeling`, `test-driven-development`, `ponytail`, `verification-before-completion`, and PDF skill for source-page extraction.

**Dependencies:** Phase 1 contracts and test infrastructure.

**Acceptance criteria:** deterministic unit tests cover recognized/unknown labels, performer suffixes, CRLF, whitespace, repetitions, Unicode, conservative artifacts, validation errors and preservation of raw input.

**Out of scope:** PDF rendering and pagination, UI integration, fetching lyrics, translation or rewriting. Phase 3 consumes resolved paper dimensions and normalized lyrics.

**Completion checklist:**

- [x] Add focused tests first for lyrics parsing, validation, units, presets, and geometry.
- [x] Implement pure lyrics and paper modules with explicit domain results.
- [x] Verify normalization, preservation, invalid-input behavior, and all standard preset geometry.
- [x] Run the required unit, browser, type, lint, startup, and production-build checks; retain Phase 1 regression coverage.
- [x] Update project status, decisions, and implementation evidence.

**Verification:** See the 2026-11-26 Phase 2 entry in `docs/IMPLEMENTATION_LOG.md`.

**Status:** COMPLETE.

## Phase 3 — Core PDF Generation Engine (20%)

**Objective:** Turn validated normalized songs into a correct, monochrome document snapshot.

**Scope:** Consume Phase 2 validated normalized songs and resolved portrait dimensions; centralized PDF geometry; embedded OFL-licensed Roboto; all registered paper sizes in production rendering; title/artist/body typography; continuous two-column layout; repeated full-width header; one blank section separator; no font shrinking or artificial balancing; immutable byte snapshot, PDF Blob and safe filename metadata.

**Skills:** `writing-plans`, `domain-modeling`, `test-driven-development`, `ponytail`, PDF skill, `verification-before-completion`.

**Dependencies:** Phases 1–2; bundled Roboto OFL assets.

**Acceptance criteria:** generated documents preserve supported normalized content, exact page dimensions and font sizes; long text flows in order without clipping, dropped content, duplicate labels or artificial extra pages; unsupported glyphs and unsafe headers/tokens fail safely; extraction and rendered pages are inspected.

**Out of scope:** production preview, download controls and exhaustive mixed-script fallback.

**Completion checklist:**

- [x] Add focused production-generation tests against actual PDF bytes.
- [x] Implement embedded font registry, glyph/layout checks, filename creation, and immutable PDF snapshot.
- [x] Generate every registered paper size and custom portrait dimensions with continuous two-column flow and repeated headers.
- [x] Verify text extraction/order, font embedding, dimensions, representative rendered pages, and safe failures.
- [x] Run required type, lint, unit, browser, startup, and production-build checks; record limitations and Phase 4 handoff.

**Verification:** See the 2026-11-26 Phase 3 entry in `docs/IMPLEMENTATION_LOG.md`.

**Status:** COMPLETE.

## Phase 4 — Advanced Pagination & Multilingual Support (16%)

**Objective:** Harden pagination and embedded-font behavior for long, mixed-script lyrics and custom paper.

**Scope:** header/body fit and wrapping; section-label keep-with-first-line; no leading separators at boundaries; boundary-safe continuous flow; Korean, Japanese, Chinese and mixed romanization; script-appropriate fonts, fallback, embedding, output size and memory evaluation.

**Skills:** `writing-plans`, `domain-modeling`, `test-driven-development`, PDF skill, `verification-before-completion`.

**Dependencies:** Phase 3 layout and approved font strategy.

**Acceptance criteria:** deterministic fixture matrix across scripts and page boundaries; font/glyph and text extraction verified; representative rendered pages show no overlaps, clipping, tofu or blank terminal pages.

**Out of scope:** UI preview controls and external font services.

**Completion checklist:** COMPLETE — bundled and verified licensed script assets; implemented deterministic script/glyph fallback and on-demand same-origin loading; implemented Unicode-aware wrapping and boundary-aware pagination; exercised mixed-script, long-header, section/column/page boundary and custom-paper layouts; recorded asset size and performance evidence in the implementation log; ran required verification.

**Verification:** See the 2026-11-26 Phase 4 entry in `docs/IMPLEMENTATION_LOG.md`.

**Status:** COMPLETE.

## Phase 5 — UI/UX & Design System (18%)

**Objective:** Build the responsive, accessible editorial workspace for song input and paper settings.

**Scope:** desktop editor/preview arrangement; mobile stacked flow; title/artist fields; lyrics editor; paper selection and custom dimensions; validation and generation lifecycle states; stale-preview feedback; accessible labels, announcements, keyboard focus, reduced motion; approved colors and Manrope.

**Skills:** `writing-plans`, `frontend-design`, `impeccable`, `ponytail`, `vercel-react-best-practices`, `test-driven-development`, `verification-before-completion`.

**Dependencies:** Phases 2–3; design tokens from Phase 1.

**Acceptance criteria:** responsive behavior at 320/375/768/1280 px; no document-level horizontal overflow; keyboard/screen-reader labels, visible focus and clear errors; no lost input on failure.

**Out of scope:** preview implementation, cloud processing, authentication.

**Completion checklist:** COMPLETE — implemented the production editor, paper settings and responsive summary panel; validated standard/custom paper, unit conversion, input errors, generation, stale/reset/error/loading states; retained monochrome PDF output; visually inspected 320/375/768/1024/1280/1440 px; added semantic/keyboard, contrast, reduced-motion, privacy and lazy-loading checks; ran the full required quality matrix.

**Verification:** See the 2026-11-26 Phase 5 entry in `docs/IMPLEMENTATION_LOG.md`.

**Status:** COMPLETE.

## Phase 6 — PDF Preview, Download & Integration (14%)

**Objective:** Integrate the PDF snapshot into a true preview and same-byte download flow.

**Scope:** PDF.js worker, actual generated-byte preview, page navigation, zoom/fit-width/fullscreen, lifecycle disposal and object URL cleanup, stale revision guards, safe filename and download of exactly the previewed snapshot, recoverable preview errors.

**Skills:** `writing-plans`, `test-driven-development`, React best practices, `ponytail`, `verification-before-completion`.

**Dependencies:** Phases 2–5.

**Acceptance criteria:** PDF.js loads locally and lazily from the same installed version as its worker; the current snapshot renders to a canvas and selectable text layer; page navigation, 96 CSS px / 72 pt reference scale, fit-page/fit-width, 50–200% zoom in 25% steps, resize, and fullscreen work; output resolution is bounded. Preview operations reuse the same byte snapshot. Download remains disabled while stale, generating, loading or rendering and downloads that snapshot under its safe filename. Revisions prevent out-of-order results; replacement, failure, reset and unmount cancel/dispose resources. E2E verifies actual pixels, page text, multipage controls, stale blocking, fallback fullscreen, real browser download bytes, reset, and lazy worker loading.

**Out of scope:** backend, cloud storage, online lyrics retrieval.

**Completion checklist:**

- [x] Load the local PDF.js runtime and matching worker on demand.
- [x] Render actual pages and selectable text from the retained snapshot; add bounded scale, navigation, fit and fullscreen controls.
- [x] Gate download on current rendered state and download the same snapshot bytes under its safe filename.
- [x] Dispose render, text-layer, document and temporary URL resources across replacement, reset and unmount.
- [x] Verify Chromium behavior, exact download bytes, responsive preview, and all required checks.

**Verification:** See the 2026-11-26 Phase 6 entry in `docs/IMPLEMENTATION_LOG.md`.

**Status:** COMPLETE.

## Phase 7 — Refinement, Testing & Release Readiness (8%)

**Approved milestone — Lyrie Brand Identity Integration:** Apply the supplied official logo and browser icon, update the masthead and page introduction, set static Lyrie metadata, add focused responsive/accessibility/asset regression coverage, and record evidence. This milestone does not add a phase, change weighting, change PDF output, or close the deployed-browser release gate.

**Objective:** Validate the complete application against product, quality, privacy and release gates.

**Scope:** full test matrix; accessibility/responsive review; performance/resource limits; output/font notices; documentation; static Vercel configuration and deployed smoke test only when deployment is requested/available.

**Skills:** `writing-plans`, `requesting-code-review`, `impeccable`, `verification-before-completion`, `finishing-a-development-branch` when applicable.

**Dependencies:** Phases 1–6.

**Acceptance criteria:** all P0 requirements in source PDF page 14 are supported by evidence; no unresolved high-severity issues; commands, lockfile, font notices, client-only privacy and known limits documented; deployment claims are evidence-based.

**Out of scope:** new product capabilities absent from the approved specification.

**Completion checklist:**

- [x] Render and review all 14 pages of the authoritative specification; trace FR-01–FR-12, T01–T13, and page 14 release gates in `docs/RELEASE_CHECKLIST.md`.
- [x] Reinstall from `package-lock.json`; run typecheck, lint, all 260 unit tests, the full Chromium E2E suite, and production build.
- [x] Verify generation, preview, page controls, multilingual text, privacy boundary, and exact download bytes in Chromium 159, Firefox 159, and WebKit 27.2, against both Vite and the production build under Vercel-equivalent headers.
- [x] Stress 1,000 synthetic lyric lines: 26 pages, first and last content visible; latest parallel-run generation and preview took 21.4 seconds with approximately 64 MB reported Chromium JS heap.
- [x] Verify all eight documented Noto CJK file sizes and SHA-256 hashes; inspect Vercel static build configuration and production build output.
- [x] Reproduce and fix the Legal renderer-height mismatch with a lyric-free regression fixture; verify the exact local input through processing, PDF generation, PDF.js extraction/page count, and snapshot Blob byte equality.
- [x] Refine renderer-safe pagination so visual height advances the cursor and renderer extents are checked per proposed line; verify atomic section starts, canonical annotated labels, and the exact local input's extracted text and one-page Legal geometry.
- [x] Implement the approved 48-type canonical section registry with explicit aliases and decimal numbering; verify shared annotation removal, conservative multiline handling, all-section PDF output, and new-section pagination behavior.
- [x] Re-run the available Family input through the production editor and confirm preview/download byte equality in Chromium and Brave; run the development Chromium suite and Chromium/Firefox/WebKit matrix. The separate Ikaw raw input is not available, so its exact-input result remains unverified.
- [x] Final locked install, `npm audit`, typecheck, lint, 260 unit tests, 23 Chromium E2E tests, both development and production-artifact browser matrices, and production build. Added explicit fullscreen Tab/Shift+Tab wrap assertions and three generate/reset lifecycle cycles.
- [x] Locally enforce the configured Vercel CSP/security headers against `dist`; verify the main app and worker MIME type, browser compatibility, same-byte download, and production CJK font asset hashes.
- [x] User reports successful completion of the previously provided manual accessibility checklist using Windows Narrator. Fresh targeted automated checks also pass for field semantics/validation, responsive reflow, keyboard names/focus, reduced motion, sampled contrast, and native/CSS fullscreen behavior. Record this as user-performed manual evidence; it is not an exhaustive WCAG 2.2 AA audit or conformance claim.
- [x] Complete the Lyrie Brand Identity Integration milestone: use the approved logo/icon assets; update masthead, H1, metadata and documentation; verify dev and local production-preview assets and responsive layout from 320–1440 px; preserve PDF output and application behavior.
- [ ] After a deployment is explicitly authorized and available, run the deployed browser smoke test for worker/font paths and exact-byte download. Local production preview passes; no remote deployment was performed.

**Status:** IN PROGRESS — the project-defined accessibility checklist and local product, document, engineering, privacy, and production evidence are recorded. The mandatory deployed-browser gate remains open; do not claim Phase 7 complete or the project 100% complete. No comprehensive WCAG conformance claim is made.
