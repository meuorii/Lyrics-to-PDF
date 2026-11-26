# Working Product Specification

**Authority:** `../Lyrics_to_PDF_Complete_Product_and_Implementation_Specification.pdf` (14 pages, version 1.0, prepared 26 November 2026). Source requirements below include page references. The original remains authoritative.

## Product overview (source pages 1–2)

A focused browser utility for preparing one clean, printable lyric sheet from user-pasted lyrics. Users enter song title and artist, paste plain text, choose paper settings, generate/inspect a PDF, then download it. No account or URL is required.

## Verified functional requirements (source pages 3–4, 11, 13–14)

- Song title and artist are nonblank; retain entered text; no lyrics URL workflow (p. 3).
- Accept multiline plain text, preserve Unicode and line order, validate nonblank lyrics (p. 3).
- Default to A4; support standard and custom portrait paper sizes, mm/in conversion, and reject unusable dimensions (p. 3–4).
- Remove performer suffixes only from recognized complete bracketed section labels; preserve label numbering and unknown bracketed text (p. 3, 6).
- Normalize CRLF/CR and BOM; trim outer blank lines; collapse repeated blank lines to one; preserve meaningful stanza breaks; do not add paragraph gap; keep one blank line between sections (p. 4, 6).
- Produce equal two-column sequential flow: left, right, next page. A section may cross a boundary without a duplicate label (p. 4, 6).
- Repeat the song title and artist across every page. Title 16 pt bold; artist 11 pt regular; lyrics and labels 12 pt regular. A4 portrait default; 15 mm margins; 6 mm gutter; black text on white; selectable output; no page numbers, watermarks, artificial balancing, or font shrinking (p. 4).
- Preview the actual generated PDF and download those same bytes. Production preview controls, stale protection, fullscreen, filename sanitization and complete UI states are later-phase requirements (p. 3, 9–11).
- Preserve input through recoverable errors; prevent stale asynchronous output; reset PDF resources; never report preview readiness before successful rendering (p. 10–11).

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

Minimalist Editorial: canvas #FAFAF7 (60% guidance), yellow #F4E11B (30% guidance), blue #0035AD (10% guidance), white surfaces, ink #1C1C1C/muted #66665F, border #E3E3DC/preview #EFEFEA, tint #FFF9D6, hover #002B8F/pressed #00216E. Proportions describe hierarchy, not literal pixel coverage. Manrope; 4–6 px corners; 8 px spacing rhythm; flat surfaces and restrained motion. Avoid Abii-style bento, mascot, oversized hero, gradient, glass, heavy shadows or decorative animation.

Target WCAG 2.2 AA. Persistent labels; logical keyboard order; visible focus; status/error announcements; keyboard controls and no fullscreen traps; reduced motion. At 320, 375, 768 and 1280 px there is no horizontal document overflow. On mobile editor precedes stacked preview; preview may pan internally when zoomed.

## Privacy, scope and acceptance (source pages 2, 5, 7, 14)

Lyrics remain in browser memory and are not transmitted or persisted by default. No API, authentication, database, external lyrics fetch, AI rewrite, translation, payment, cloud storage or batch workflow. Phase 1 accepts only its technical foundation and feasibility gates; the P0 release definition on p. 14 governs the whole future application, not this phase.

The full release gates (source p. 14) require all required input/normalization/paper options and 12 pt layout; no truncation, clipping, overlap, extra pages or missing glyphs; same-byte PDF preview/download and lifecycle/error recovery; accessible independent editorial desktop/mobile UI; strict typecheck, lint, unit/E2E and build with locked dependencies; private local processing and verified font rights/notices; evidence-based static deployment; and setup, supported-size, font and known-limit documentation. Those product gates are intentionally not claimed complete by Phase 1.

## Verified versus not yet implemented

**Verified source requirements:** the preceding facts and page references were extracted from every page of the original PDF. **Phase 1 implementation decisions:** client-only Vite shell; typed contract names are in `src/types/domain.ts`; PDF output uses pdfmake’s bundled Roboto as a licensed Latin/romanized face. **Phase 2 implementation decisions:** `src/features/lyrics/` supplies normalization and structured validation; Genius cleanup removes only standalone lines containing an explicit `genius.com` URL; `src/features/paper/` defines and validates portrait presets/custom dimensions; `processSongInput` is the normalized generation boundary. **Phase 3 implementation decisions:** `src/features/pdf/` consumes validated data and `generatePdf` produces an embedded-font PDF snapshot for registered and custom portrait sizes. **Phase 4 implementation decisions:** script/glyph-aware fallback embeds Roboto and official Noto Sans CJK JP/KR/SC/TC OTF faces; dynamic headers and UAX 14/grapheme-safe wrapping feed section-aware, boundary-safe pagination. PDF.js and Chromium verify extraction and raster output. Ambiguous Han-only text defaults to Japanese; unsupported missing glyphs fail with a typed error. **Not yet delivered (later phases):** responsive production workspace, PDF preview/navigation and download integration.

**Open question:** production use of Aptos requires the precise font asset and applicable embedding/redistribution rights. The original spec prefers Aptos but does not establish those rights. See `TECHNICAL_DECISIONS.md`.
