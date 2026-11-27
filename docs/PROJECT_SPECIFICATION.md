# Working Product Specification

## Approved Lyrie branding amendment

The public-facing product name is **Lyrie** and its tagline is **Lyrics made simple.** The descriptive category remains “Lyrics to PDF Converter.” Use the prepared `public/brand/lyrie-logo.svg` for the interface masthead and `public/brand/lyrie-icon.svg` plus its PNG fallback for browser icons. The masthead uses the existing `#FAFAF7` canvas and neutral border so the approved blue identity and yellow sparkle remain legible; the application-wide palette and Manrope typography are otherwise unchanged. `index.html` carries the Lyrie title, application name, description, theme color, and approved Open Graph title/description/type/site name. Domain-dependent canonical and sharing image metadata is deferred until approved domain/assets exist. Branding applies to application chrome only: generated PDFs remain monochrome and receive no Lyrie branding or metadata changes.

**Authority:** `../Lyrics_to_PDF_Complete_Product_and_Implementation_Specification.pdf` (14 pages, version 1.0, prepared 26 November 2026). Source requirements below include page references. The original remains authoritative.

## Approved V2 interface and notifications amendment

Use the supplied desktop and mobile interface references as the Phase 7 refinement target. The interface uses a 64 px mobile / 72 px desktop masthead without an in-header privacy badge; retain the in-browser privacy statement in the page footer. At desktop widths use a 40:60 editor-to-preview split and stack editor before preview on mobile. Keep the editor order title, artist, lyrics, paper settings, primary action, reset action. Use 8 px controls, 12 px inner surfaces, 16 px panels, Tailwind-first interface layout/control utilities, the existing Lyrie palette and Manrope. Preserve specialized PDF.js canvas/text-layer/viewport styles and all generated PDF geometry and bytes.

Add accessible in-app notifications for generation start and success/failure, preview failure, stale state, download start/failure, and meaningful reset. Generation success follows successful PDF.js rendering; loading is replaced in place. Keep errors persistent until dismissed, show at most two toasts while queuing extras, support deduplication and pauseable timed progress, and place the viewport inside the preview subtree so notifications remain available in native fullscreen. Keep inline validation and existing recoverable error details. This amendment does not authorize deployment or close Phase 7.

## Product overview (source pages 1–2)

A focused browser utility for preparing one clean, printable lyric sheet from user-pasted lyrics. Users enter song title and artist, paste plain text, choose paper settings, generate/inspect a PDF, then download it. No account or URL is required.

## Verified functional requirements (source pages 3–4, 11, 13–14)

- Song title and artist are nonblank; retain entered text; no lyrics URL workflow (p. 3).
- Accept multiline plain text, preserve Unicode and line order, validate nonblank lyrics (p. 3).
- Default to A4; support standard and custom portrait paper sizes, mm/in conversion, and reject unusable dimensions (p. 3–4).
- Normalize complete recognized bracketed section labels to canonical capitalization, preserve explicit decimal numbering, and remove supported song-reference and performer annotations while preserving unknown/malformed bracketed text and ordinary lyric parentheses (p. 3, 6; approved release refinement).
- Normalize CRLF/CR and BOM; trim outer blank lines; collapse repeated blank lines to one; preserve meaningful stanza breaks; do not add paragraph gap; keep one blank line between sections (p. 4, 6).
- Produce equal two-column sequential flow: left, right, next page. A section may cross a boundary without a duplicate label (p. 4, 6).
- Keep every rendered line of a recognized section heading with the first rendered lyric line belonging to that section. Advance visual placement by glyph height while checking each proposed line against the renderer's font-metric extent; retain the approved margins, gutter, font sizes and spacing (release clarification).
- Repeat the song title and artist across every page. Title 16 pt bold; artist 11 pt regular; lyrics and labels 12 pt regular. A4 portrait default; 15 mm margins; 6 mm gutter; black text on white; selectable output; no page numbers, watermarks, artificial balancing, or font shrinking (p. 4).
- Preview the actual generated PDF and download those same bytes. Production preview controls, stale protection, fullscreen, filename sanitization and complete UI states are later-phase requirements (p. 3, 9–11).
- Preserve input through recoverable errors; prevent stale asynchronous output; reset PDF resources; never report preview readiness before successful rendering (p. 10–11).

### Approved section normalization refinement

The parser recognizes the following 48 canonical section names: Intro, Verse, Pre-Verse, Pre-Chorus, Chorus, Post-Chorus, Bridge, Refrain, Hook, Interlude, Outro, Coda; Rap, Rap Verse, Spoken Word, Spoken Intro, Spoken Outro, Dialogue, Skit, Narration, Freestyle; Instrumental, Instrumental Break, Instrumental Intro, Instrumental Outro, Solo, Guitar Solo, Piano Solo, Drum Solo, Bass Solo, Break, Breakdown, Dance Break, Build-Up, Drop, Pre-Drop, Post-Drop, Transition, Reprise; Medley, Ad-Libs, Vocal Break, Vocal Solo, Chant, Choir, Sample, Call and Response, Vocalizing.

Recognition is case-insensitive and uses explicit aliases: Pre Verse → Pre-Verse; Pre Chorus → Pre-Chorus; Post Chorus → Post-Chorus; Spoken-Word → Spoken Word; Build Up → Build-Up; Pre Drop → Pre-Drop; Post Drop → Post-Drop; Adlibs and Ad Libs → Ad-Libs; Call & Response → Call and Response. Equivalent internal whitespace is collapsed for heading matching. The longest registered name wins. No fuzzy, substring, or unrestricted punctuation matching is permitted.

Every registered type accepts an optional explicitly supplied decimal section number; the digits are preserved as entered and are never inferred or renumbered. A heading is reconstructed only from its canonical name, optional number, and brackets. Balanced parenthesized song references, nonempty colon-delimited performer annotations, and Medley song lists are removed only after the whole standalone heading validates. A clear one-line annotation continuation may be joined conservatively; ambiguous or malformed candidates, inline brackets, ordinary lyric parentheses, unknown section names, and actual lyric content remain unchanged. The approved registry covers the intended application scope and is not represented as an exhaustive third-party taxonomy.

### Paper presets (source page 4)

A3 297×420 mm; A4 210×297; A5 148×210; A6 105×148; ISO B4 250×353; ISO B5 176×250; Letter/Short 215.9×279.4; Long Bond 215.9×330.2; Legal 215.9×355.6. All portrait. Custom dimensions accept mm or inches.

## Application flow (source page 11)

Enter song metadata and paper → paste lyrics → validate and normalize → generate bytes → load PDF preview → inspect/edit/regenerate → download the same current bytes. Missing input returns to the editor with errors; invalid geometry is explained; PDF/font/preview failures keep input and offer recovery; edits invalidate stale output; reset disposes resources.

## Technical architecture (source pages 5–7)

Static, client-side React/TypeScript/Vite application. Pure lyrics normalization/validation boundary feeds pdfmake layout with embedded licensed fonts. A generated immutable PDF snapshot is shared by PDF.js preview and browser download. No server, database, credentials, lyrics upload, telemetry payload or persistent draft by default. Lazy-load heavier PDF assets where practical. Keep app UI, lyrics, paper configuration, PDF layout/generation, preview lifecycle and domain types separated without a state library.

Core domain terms from source p. 7: `SongInput` (metadata/raw lyrics/paper), `PaperSpec`, `NormalizedLyrics` (ordered tokens/warnings without mutating raw text), `PdfSnapshot` (bytes/Blob/name/page count/revision/geometry), and typed `GenerationError`.

## Lyrics processing rules (source pages 3, 6, 13)

Processing is conservative and deterministic. Only recognized complete section-label lines may lose performer suffixes. Preserve numbers, unknown bracketed text, parentheses, repeated lines, punctuation, Unicode and ambiguous content. Remove only clearly identified site chrome. Do not rewrite or translate. Phase 1 defines boundaries and fixtures; production transformation is Phase 2.

## PDF layout and typography (source pages 4–7, 13–14)

Convert mm to PDF points using `mm × 72 / 25.4`. Usable page width subtracts two margins; each equal column is `(usable width − gutter) / 2`. Reserve repeated header height plus 12 pt body gap. Use actual embedded font metrics; keep a label with its first lyric line; suppress a separator at a column/page boundary; allow following lines to flow; reject unusable page dimensions; stop after all content without empty terminal pages. The final preferred lyrics face is Aptos if the rights permit it; otherwise use a licensed embedded fallback. Never silently substitute missing glyphs. UI typeface is Manrope; PDF output stays monochrome.

## Design system and accessibility (source pages 8–10)

Minimalist Editorial: canvas #FAFAF7 (60% guidance), yellow #F4E11B (30% guidance), blue #0035AD (10% guidance), white surfaces, ink #1C1C1C/muted #66665F, border #E3E3DC/preview #EFEFEA, tint #FFF9D6, hover #002B8F/pressed #00216E. Proportions describe hierarchy, not literal pixel coverage. Manrope; 4–6 px corners; 8 px spacing rhythm; flat surfaces and restrained motion. Avoid Abii-style bento, mascot, oversized hero, decorative gradients, glass, heavy shadows or decorative animation. **User-approved exception (2026-11-27):** the page canvas may use one very faint radial transition from #F4E11B into #FAFAF7; keep cards, controls, text, and PDF surfaces flat.

Target WCAG 2.2 AA. Persistent labels; logical keyboard order; visible focus; status/error announcements; keyboard controls and no fullscreen traps; reduced motion. At 320, 375, 768 and 1280 px there is no horizontal document overflow. On mobile editor precedes stacked preview; preview may pan internally when zoomed.

## Privacy, scope and acceptance (source pages 2, 5, 7, 14)

Lyrics remain in browser memory and are not transmitted or persisted by default. No API, authentication, database, external lyrics fetch, AI rewrite, translation, payment, cloud storage or batch workflow. Phases 1–6 have passed their phase gates; the P0 release definition on p. 14 governs the full application and Phase 7 release gates remain.

The full release gates (source p. 14) require all required input/normalization/paper options and 12 pt layout; no truncation, clipping, overlap, extra pages or missing glyphs; same-byte PDF preview/download and lifecycle/error recovery; accessible independent editorial desktop/mobile UI; strict typecheck, lint, unit/E2E and build with locked dependencies; private local processing and verified font rights/notices; evidence-based static deployment; and setup, supported-size, font and known-limit documentation. Phase 6 preview/download gates have passed; the full release gates are not claimed complete until Phase 7.

## Verified versus not yet implemented

**Verified source requirements:** the preceding facts and page references were extracted from every page of the original PDF. **Phases 1–4 implementation decisions:** client-only Vite shell and typed contracts; pure lyrics processing, paper resolution and validation; actual embedded-font PDF snapshots; script/glyph-aware fallback with official Noto Sans CJK JP/KR/SC/TC OTF faces; dynamic headers and Unicode-safe wrapping feed section-aware, boundary-safe pagination. PDF.js and Chromium verify extraction and raster output. Ambiguous Han-only text defaults to Japanese; unsupported missing glyphs fail with a typed error. **Phase 5 implementation:** responsive production workspace validates and generates real snapshots and keeps all form data in memory. **Phase 6 implementation:** local PDF.js lazily renders the current snapshot to a bounded canvas and selectable text layer. Page navigation, zoom, fit, native/CSS fullscreen, lifecycle disposal, stale download blocking and same-byte download are implemented. **Phase 7 local evidence (2026-11-27):** strict typecheck, lint, 260 unit tests, 24 Chromium E2E tests, development and production-artifact Chromium/Firefox/WebKit matrices, fresh locked install, zero-vulnerability dependency audit, production build under the configured security headers, a 1,000-line stress workflow, and font hash checks pass. The Lyrie branding milestone verifies official logo and favicon responses, metadata, accessibility naming, and responsive layout through 1440 px in development and the local production preview. The project's accessibility checklist is complete: targeted automated checks pass and the user reports all prior manual checklist items passed with Windows Narrator. This is not a comprehensive WCAG 2.2 AA conformance claim. Release is not complete: the page-14 deployed-browser smoke test remains open; public deployment was not authorized. The separate Ikaw raw input is unavailable; no exact result is claimed. See `RELEASE_CHECKLIST.md`.

**Open question:** production use of Aptos requires the precise font asset and applicable embedding/redistribution rights. The original spec prefers Aptos but does not establish those rights. See `TECHNICAL_DECISIONS.md`.
