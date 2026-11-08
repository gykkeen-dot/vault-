---
name: ui-polish
description: Design and polish UI so it looks intentional, not generic. Use when building or restyling any screen, component, page or layout (web or React Native), when the user says "make it look better", "ugly", "clean up the UI", asks for a design, or shares a reference. Covers hierarchy, spacing, type, colour, states, motion and a verify-by-screenshot loop.
---

# ui-polish

Goal: every screen has a clear point of view, one obvious action, and no default-looking parts. Work in this order; do not skip the check at the end.

## 1. Decide before drawing
- **Purpose:** one sentence: what does the user do here? That is the primary action; everything else is secondary.
- **Vibe:** pick 3 adjectives (e.g. "quiet, lacquered, editorial"). Reject anything that contradicts them.
- **Reuse first:** read the existing theme/tokens/components and extend them. Never hard-code a colour, size or font that a token already covers.

## 2. Tokens (define once, use everywhere)
- **Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48. No odd values like 13 or 22.
- **Radius:** 2 to 3 values total. Nested radius = outer radius minus padding.
- **Type:** one display face + one body face, max. 4 sizes (caption 12, body 14-16, title 20-24, hero 32+). Weight and case carry hierarchy, not extra fonts.
- **Colour:** neutral ground + one accent. Text on 3 levels (primary, dim ~60%, faint ~40%). Status colours (warn/error/ok) only for status. Check contrast: body text 4.5:1, large text 3:1.
- **Elevation:** hairline borders or soft shadows, pick one language and stay with it.

## 3. Layout and hierarchy
- Squint test: blur your eyes mentally; the primary action and the headline must still stand out. Only one filled/high-contrast button per screen.
- Group by proximity: space inside a group < space between groups (at least 2x).
- Align to one left edge; consistent gutters (16-24). Do not centre long text.
- Prefer whitespace over dividers and boxes. Cards only when content is truly separate.
- Lists: consistent row height, clear tap target (min 44x44 pt), one line of primary text + one of secondary.

## 4. Every state, not just the happy path
For each component or screen build: **loading** (skeleton, not a lone spinner), **empty** (say what to do next, with an action), **error** (what happened + retry), **disabled**, **pressed/focused**, **long text** (truncate or wrap deliberately), **small and large screens**.

## 5. Motion and feel
- Motion explains change (enter, exit, reorder); 150-250 ms, ease-out for entering, ease-in for leaving. No bounce unless the brand is playful.
- Press feedback on every tappable thing (opacity or 1-2px translate).
- Respect reduced-motion and dynamic type; never rely on colour alone.
- React Native: use `Pressable`, `expo-image`, safe-area insets, `FlatList` for long lists, animate with transform/opacity only (Reanimated if available).

## 6. Details that read as "expensive"
Consistent icon stroke weight; optical alignment of icons with text; tabular/mono numerals for prices and counters; uppercase + letter-spacing only for small labels; real copy (never "Lorem ipsum" or "Click here"); one signature touch (a gloss edge, a hairline rule, an oversized number) used sparingly.

## 7. Verify (required)
1. Render it: web via Playwright (Chromium is preinstalled; `deviceScaleFactor: 2`), RN via `expo start --web` and screenshot at 390x844 and 768x1024.
2. Look at the screenshot and run the squint test, spacing scale, contrast and state checklist above.
3. Fix at least one thing you see, re-shoot, then report: what changed, which tokens were used, any open issues. Never claim it looks good without having looked.

## Anti-patterns (fix on sight)
Centre-aligned everything; 3+ accent colours; gradients/shadows with no purpose; 5 font sizes within one card; full-width tiny text; buttons of equal weight side by side; icon-only buttons with no label or aria/accessibility label; spinner on a blank screen; text over images without a scrim.
