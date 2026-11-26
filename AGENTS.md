# Lyrics to PDF agent instructions

## Purpose and source hierarchy

Build a private, client-side utility that formats user-provided song lyrics into a printable PDF. The authoritative product baseline is [`Lyrics_to_PDF_Complete_Product_and_Implementation_Specification.pdf`](./Lyrics_to_PDF_Complete_Product_and_Implementation_Specification.pdf) (14 pages). Read project context in this order:

1. `AGENTS.md`
2. `docs/IMPLEMENTATION_PLAN.md`
3. The latest relevant entry in `docs/IMPLEMENTATION_LOG.md`
4. Relevant sections of `docs/PROJECT_SPECIFICATION.md`
5. Relevant sections of `docs/TECHNICAL_DECISIONS.md`
6. The original PDF when exact requirements or visual references need checking
7. Source files relevant to the current task

The PDF is authoritative for product requirements. The roadmap in `docs/IMPLEMENTATION_PLAN.md` controls phase order. Record conflicts and decisions; do not silently relax a requirement.

## Approved stack and architecture

React, Vite, strict TypeScript, Tailwind CSS, pdfmake, PDF.js (`pdfjs-dist`), Lucide React, Vitest, Playwright, ESLint, npm, and a future static Vercel deployment. Keep PDF work in the browser. Keep domain contracts independent of React. Keep raw lyrics distinct from normalized lyrics; do not add state libraries, servers, accounts, databases, lyrics APIs, persistence, or telemetry without an approved requirement.

## Phase strategy and scope

There are seven weighted phases: technical foundation 12%; lyrics processing 12%; core PDF engine 20%; pagination and multilingual support 16%; interface/design system 18%; preview/download integration 14%; refinement/release 8%. Implement only the current phase. Phases 1–4 are complete (4/7, 60%); Phase 5 — UI/UX & Design System — is next and ready. Follow the roadmap acceptance criteria before changing status.

## Coding conventions

- Use small, focused TypeScript modules and explicit domain types; avoid unsafe `any`.
- Keep PDF layout values and units centralized. Use points for PDF geometry and mm for user-facing paper dimensions.
- Preserve user text and process it only according to documented rules.
- Keep the PDF monochrome and independent of interface tokens.
- Keep the interface minimalist editorial: Manrope, #FAFAF7, #F4E11B and #0035AD; restrained borders, 4–6 px corners, visible focus, and reduced motion.
- Prefer the smallest implementation that fully satisfies the current phase. Avoid unused placeholders and speculative abstractions.
- Keep lyrics in memory only. Do not add network submission, storage, analytics, or secrets.
- `src/features/lyrics/` owns pure normalization, section recognition, and input validation; `src/features/paper/` owns presets, unit conversion, dimension resolution, and foundational geometry. `processSongInput` is the generation boundary; `src/features/pdf/` owns PDF layout, fonts, filenames, and generation. The PDF renderer embeds Roboto for Latin text and loads licensed Noto Sans CJK faces on demand for supported CJK scripts; it uses deterministic Japanese as the ambiguous Han-only default.

## Skills

Use relevant installed skills when work benefits from them. Use the repository's `ponytail`, `domain-modeling`, `writing-plans`, `test-driven-development`, and `verification-before-completion` guidance as relevant. Read only skills needed for the current task. Do not install third-party skills or create subagents unless explicitly requested.

## Testing and completion

For implementation changes, add focused tests and run the relevant checks. Before claiming a phase complete, run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm run build`; report actual results. Inspect browser behavior for UI changes. Do not claim verification for checks that were skipped or failed.

## Documentation and session efficiency

Update the implementation plan, technical decisions, and chronological implementation log when phase scope or evidence changes. Prefer targeted file reads and extracted specification sections over rescanning the repository or rereading all 14 PDF pages. Preserve the original PDF and existing user changes. Do not run destructive Git operations. Leave a concise next-phase starting point in the log.
