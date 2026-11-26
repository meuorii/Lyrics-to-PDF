# Lyrics to PDF — Seven-Phase Implementation Roadmap

The original 14-page specification is authoritative. The percentages total 100%. Phases 1 and 2 are complete; only Phase 3 is ready to begin. Later phases remain NOT STARTED.

## Progress

- Completed phases: 2 / 7
- Weighted implementation progress: 24%
- Completed phases: Phase 1 — Technical Foundation & Feasibility; Phase 2 — Lyrics Processing & Validation Engine
- Next phase: Phase 3 — Core PDF Generation Engine — NOT STARTED; READY FOR IMPLEMENTATION

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

**Scope:** Consume Phase 2 resolved portrait dimensions and normalized lyrics; centralized PDF geometry; embedded approved font; supported paper sizes in production rendering; title/artist/body typography; continuous two-column layout; repeated full-width header; one blank section separator; no font shrinking or artificial balancing; Blob/bytes and safe filename metadata.

**Skills:** `writing-plans`, `domain-modeling`, `test-driven-development`, `ponytail`, PDF skill, `verification-before-completion`.

**Dependencies:** Phases 1–2; licensing-approved font assets.

**Acceptance criteria:** generated documents preserve all normalized content, dimensions and font sizes; long text flows in order without clipping, dropped content, duplicate labels or extra pages; extraction and rendered pages are inspected.

**Out of scope:** production preview, download controls and exhaustive mixed-script fallback.

**Completion checklist:** NOT STARTED — implement paper model, font registry and production generator; verify extracted text, page geometry and representative renders.

**Status:** NOT STARTED.

## Phase 4 — Advanced Pagination & Multilingual Support (16%)

**Objective:** Harden pagination and embedded-font behavior for long, mixed-script lyrics and custom paper.

**Scope:** header/body fit and wrapping; section-label keep-with-first-line; no leading separators at boundaries; boundary-safe continuous flow; Korean, Japanese, Chinese and mixed romanization; script-appropriate fonts, fallback, embedding, output size and memory evaluation.

**Skills:** `writing-plans`, `domain-modeling`, `test-driven-development`, PDF skill, `verification-before-completion`.

**Dependencies:** Phase 3 layout and approved font strategy.

**Acceptance criteria:** deterministic fixture matrix across scripts and page boundaries; font/glyph and text extraction verified; representative rendered pages show no overlaps, clipping, tofu or blank terminal pages.

**Out of scope:** UI preview controls and external font services.

**Completion checklist:** NOT STARTED — choose script assets; verify licensing; implement fallback; exercise long/mixed-script layouts; record size/performance findings.

**Status:** NOT STARTED.

## Phase 5 — UI/UX & Design System (18%)

**Objective:** Build the responsive, accessible editorial workspace for song input and paper settings.

**Scope:** desktop editor/preview arrangement; mobile stacked flow; title/artist fields; lyrics editor; paper selection and custom dimensions; validation and generation lifecycle states; stale-preview feedback; accessible labels, announcements, keyboard focus, reduced motion; approved colors and Manrope.

**Skills:** `writing-plans`, `frontend-design`, `impeccable`, `ponytail`, React best practices, `test-driven-development`, `verification-before-completion`.

**Dependencies:** Phases 2–3; design tokens from Phase 1.

**Acceptance criteria:** responsive behavior at 320/375/768/1280 px; no document-level horizontal overflow; keyboard/screen-reader labels, visible focus and clear errors; no lost input on failure.

**Out of scope:** preview implementation, cloud processing, authentication.

**Completion checklist:** NOT STARTED — implement workspace; validate viewports/states/accessibility; keep PDF presentation monochrome.

**Status:** NOT STARTED.

## Phase 6 — PDF Preview, Download & Integration (14%)

**Objective:** Integrate the PDF snapshot into a true preview and same-byte download flow.

**Scope:** PDF.js worker, actual generated-byte preview, page navigation, zoom/fit-width/fullscreen, lifecycle disposal and object URL cleanup, stale revision guards, safe filename and download of exactly the previewed snapshot, recoverable preview errors.

**Skills:** `writing-plans`, `test-driven-development`, React best practices, `ponytail`, `verification-before-completion`.

**Dependencies:** Phases 2–5.

**Acceptance criteria:** Playwright exercises generate, inspect, navigate, zoom, edit/stale, regenerate, download, failure/retry, reset and same-byte integrity without runtime errors or resource leaks.

**Out of scope:** backend, cloud storage, online lyrics retrieval.

**Completion checklist:** NOT STARTED — integrate snapshot; verify worker in build; add end-to-end lifecycle checks.

**Status:** NOT STARTED.

## Phase 7 — Refinement, Testing & Release Readiness (8%)

**Objective:** Validate the complete application against product, quality, privacy and release gates.

**Scope:** full test matrix; accessibility/responsive review; performance/resource limits; output/font notices; documentation; static Vercel configuration and deployed smoke test only when deployment is requested/available.

**Skills:** `writing-plans`, `requesting-code-review`, `impeccable`, `verification-before-completion`, `finishing-a-development-branch` when applicable.

**Dependencies:** Phases 1–6.

**Acceptance criteria:** all P0 requirements in source PDF page 14 are supported by evidence; no unresolved high-severity issues; commands, lockfile, font notices, client-only privacy and known limits documented; deployment claims are evidence-based.

**Out of scope:** new product capabilities absent from the approved specification.

**Completion checklist:** NOT STARTED — run full quality matrix; review output; confirm licensing/privacy notices; prepare release evidence.

**Status:** NOT STARTED.
