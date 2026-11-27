# Lyrie V2 Interface and Toast Design

**Status:** Approved by the user's implementation brief. The supplied screenshots and detailed requirements are the design target; no further approval is needed.

## Intent

Make the existing lyric-to-PDF workflow feel cohesive and intentional across desktop and mobile, and give important generation, preview, download, stale, and reset events clear transient feedback. Lyrics remain in memory; generated PDFs remain unchanged and monochrome.

## Target and direction

Use the user-supplied desktop and mobile screenshots as the visual target for empty, loading, ready, stale, custom-paper, and mobile-ready states. Keep Lyrie's official logo, Manrope, off-white canvas, white work surfaces, royal-blue actions, yellow tint for paper settings, and quiet neutral preview. Desktop uses an editor/preview split close to 40:60 with the preview wider; mobile stacks editor then preview. Reorder editor controls to title, artist, lyrics, paper, generate, reset.

The screenshot's 16px workspace panels, 12px inner surfaces, and 8px controls become the radius hierarchy. Use Tailwind utilities for product layout and controls; keep CSS for theme/global foundations, PDF.js layers, specialized viewport behavior, and reduced motion. No new font, library, backend, or decorative brand surface.

## Toast behavior

Use a small React context provider and a fixed viewport hosted inside the preview subtree so notifications remain visible in native fullscreen. Keep at most two toasts visible and queue the rest. Reuse IDs to transition generation loading into success or error. Start the success timer only after PDF.js reports the generated snapshot ready. Auto-dismiss success/info after 4s and warning after 6s; errors and loading persist until dismissed or replaced. Pause visible timers while hovered or focused, resume with their remaining time, show a synchronized progress bar, and honor reduced motion. Use polite live announcements for routine updates and assertive announcements for errors. Keep validation and persistent preview errors in their existing inline locations.

## Approaches considered

- Add notifications only to the existing inline status text: smallest, but misses the supplied overlay design and transient action feedback.
- Add a toast provider with explicit IDs and bounded queue, retaining App as the owner of generation state: selected because it supports true loading-to-ready transitions without moving PDF or form ownership.
- Add a notification dependency or a global state store: rejected because the project has no need for another runtime or state layer.

## Scope and limits

Improve the existing real React UI; do not recreate it as static artwork. Preserve form validation, paper conversions, generation guards, retained prior snapshots, PDF.js rendering/cleanup, fullscreen focus behavior, download eligibility, and existing copy/privacy. Keep the phase at 92% in progress, do not deploy, and do not modify generated PDF layout or content. The named V2 SVG wireframes are not present in the workspace; the screenshots attached to the request are the available references. Impeccable's executable could not start because its one-time engine cache requires network/write access outside the workspace; its local critique will use the documented craft checklist instead.
