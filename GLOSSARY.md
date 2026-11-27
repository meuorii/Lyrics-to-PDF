# Lyrics domain glossary

- **Lyrie:** The public-facing product name; “Lyrics to PDF Converter” remains its descriptive category.

- **Section heading:** A complete, standalone bracketed line that matches a registered section type and the supported annotation grammar.
- **Canonical section type:** One of the 48 supported section names used in normalized output.
- **Alias:** An explicitly supported spelling that maps to a canonical section type without changing its musical meaning.
- **Section number:** An optional decimal identifier explicitly written after a section name or alias; normalization preserves it without inferring or renumbering.
- **Referenced-song annotation:** A supported parenthesized song reference, or a Medley song list, attached to a recognized heading and removed from its normalized label.
- **Performer annotation:** A nonempty colon-delimited performer suffix attached to a recognized heading and removed from its normalized label.
- **Lyric content:** User-provided body text, including punctuation, parentheses, repeated lines, and multilingual text, preserved in order.
- **Unknown bracketed content:** Bracketed text that does not match the complete supported heading grammar; it remains lyric content.
