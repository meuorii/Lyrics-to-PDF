# Match the Lyrie initial-state reference

**Status:** Approved by the user's direct request to match the supplied second image.

## Intent

Bring the actual Lyrie workspace closer to the supplied 1440 × 1024 initial-state image. Preserve branding, user content, all PDF behavior and accessibility semantics.

## Design

Keep the approved Lyrie canvas, logo, Manrope, single-column editor form and 40:60 desktop split. Match the target's 40 px desktop title, 16/20 px panel hierarchy, less cramped editor spacing, quiet outlined preview toolbar above the canvas, and separate download/status footer beneath the canvas. Keep the 12 px preview canvas corners and yellow paper-settings surface. Retain wrapping controls on mobile and the existing fullscreen subtree.

## Approaches

- Change only colors and radii: rejected because the preview toolbar/download placement is the largest compositional mismatch.
- Reorder the real toolbar above the canvas and place the real download control in the preview footer, with a contained type/spacing adjustment: selected because it matches the image while preserving existing handlers and React component ownership.
- Rebuild the page as a screenshot or faux UI: rejected because this is the live product interface and must remain interactive and accessible.

## Constraints

No PDF bytes/layout, data handling, validation, generation, download eligibility, fullscreen, or toast lifecycle changes. Keep supported responsive behavior, focus styles, control names and hit targets. `stageshow` applies to authored product demos, so use its framing/restraint critique only; do not create a fake UI artifact.
