# Lyrie V2 Interface Implementation Plan

> **For agentic workers:** Implement this plan task by task. Keep each step testable and preserve unrelated workspace changes.

**Goal:** Refine the Lyrie workspace to the approved V2 desktop/mobile direction and add an accessible interactive toast system for real application events.

**Architecture:** App retains form, generation, snapshot, and request-identity ownership. A small toast provider owns notification queue/timers; App connects generation, stale, and reset events, while PdfPreview reports render readiness, preview failures, and download outcomes. Presentation uses Tailwind utilities and focused components; PDF geometry/rendering stays unchanged.

**Tech Stack:** React 19, strict TypeScript, Tailwind CSS 4, Lucide React, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-27-lyrie-v2-interface-design.md` and the user's pasted V2 implementation brief.

## Global Constraints

- Keep lyrics browser-only and in memory; add no dependency, network service, persistence, or analytics.
- Preserve PDF generation output, metadata, geometry, preview byte ownership, download eligibility, and resource cleanup.
- Keep Phase 7 IN PROGRESS at 92%; do not deploy.
- Preserve the official Lyrie logo, Manrope, existing brand colors, semantic colors, and visible keyboard focus.
- Use Tailwind utilities for component layout/styles; retain CSS only for global foundations and specialized PDF.js/viewport behavior.
- Respect reduced motion and minimum 44px interactive targets for notification actions.

## Review Focus

- A generation invalidated by edit/reset must never show success; test request identity and toast invalidation in `tests/e2e/workspace.spec.ts`.
- A generated snapshot is not ready until PDF.js rendered it; test loading-to-success replacement after the preview ready status.
- A stale snapshot cannot download; retain existing tests and verify warning only occurs at the stale transition.
- Multiple or repeated events must not duplicate or drop persistent errors; test queue capacity, dedupe, and manual dismissal in `tests/unit/toast.test.tsx`.
- Hover/focus pause and reduced motion must not shorten notification time or strand controls; use fake-timer component tests and browser keyboard checks.

## File Responsibilities

- Create `src/components/ui/toast/ToastProvider.tsx` for queue, IDs, dedupe, and replacement API.
- Create `src/components/ui/toast/Toast.tsx` and `ToastViewport.tsx` for accessible item rendering, pause/resume timers, progress, stacking, and motion.
- Create `src/components/ui/toast/useToast.ts` for the typed context API.
- Create `src/features/workspace/DocumentEditor.tsx` and `PaperSettings.tsx` for presentational controlled editor UI.
- Keep `src/App.tsx` as owner of form and generation state; pass typed callbacks/props to DocumentEditor/PdfPreview.
- Update `src/features/preview/PdfPreview.tsx` for Tailwind-first toolbar/panel presentation, state-preserving skeleton, toast viewport placement, and callbacks for preview-ready/error/download.
- Keep `src/styles.css` for theme/global rules, PDF.js-specific canvas/text layer, viewport/scroll mechanics, and reduced-motion support; remove migrated presentation rules.
- Add deterministic toast tests in `tests/unit/toast.test.tsx`; extend `tests/e2e/workspace.spec.ts` and `tests/e2e/preview.spec.ts` for real event coverage.
- Update `AGENTS.md`, `README.md`, project specification, technical decisions, implementation plan/log, and release checklist with evidenced results.

## Tasks

### 1. Pin the toast contract with tests

- [ ] Test all five variants, dismiss controls, two-item visible limit with queue, dedupe, and loading replacement.
- [ ] Test auto-dismiss durations, timer pause/resume on hover/focus, persistent errors, and unmount cleanup with fake timers.
- [ ] Run the focused test and confirm the new cases fail before implementation.

### 2. Implement toast provider and visuals

- [ ] Add typed provider/API, explicit IDs, queue behavior, dedupe keys, and in-place replacement.
- [ ] Add the fixed bottom-right/mobile-bottom-center viewport and status/error live regions.
- [ ] Add progress timing, hover/focus pause/resume, dismiss button, fullscreen-compatible placement, and reduced-motion styling.
- [ ] Run focused unit tests and pass all lifecycle assertions.

### 3. Integrate application events safely

- [ ] Start one loading toast per valid generation request; dismiss it on invalidation/reset.
- [ ] Replace it with success only after `PdfPreview` confirms the same snapshot rendered; replace with persistent error on generation or preview failure.
- [ ] Report stale only on the false-to-true transition, downloads as started only after initiation, and meaningful reset completion.
- [ ] Test cancellation, reset-during-generation, retained previous PDF, update, error/retry, and download protection in Playwright.

### 4. Refine workspace/editor/preview presentation

- [ ] Extract controlled `DocumentEditor` and `PaperSettings`; arrange title, artist, lyrics, paper, generate, reset.
- [ ] Apply the screenshot's panel hierarchy, typography, 8/12/16px radii, spacing, and desktop 40:60 workspace using Tailwind utilities.
- [ ] Preserve actual PDF.js page rendering, toolbar controls, metadata, stale/error states, and fullscreen focus behavior.
- [ ] Add a proportionate preview skeleton only for actual loading/rendering, retaining an already-valid previous snapshot.
- [ ] Migrate component presentation out of bespoke selectors; preserve specialized PDF.js styles and theme tokens.

### 5. Verify, critique, and document

- [ ] Run the app and inspect the supplied reference states at 320, 375, 390, 768, 1024, and 1440px; inspect empty, loading, ready, stale, custom, error, toast, and mobile states.
- [ ] Fix visible hierarchy, overflow, focus, touch target, contrast, reduced-motion, or fullscreen defects and inspect affected screenshots again.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm run build`, and `git diff --check`.
- [ ] Record skill/tool availability, screenshots/states exercised, test output, limits, and remaining deployed-browser gate. Do not mark Phase 7 complete or deploy.
