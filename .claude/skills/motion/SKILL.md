---
name: motion
description: Add purposeful motion to UI (React Native / Expo or web) so every state change feels alive. Two feels - "mac" (default: quick, soft, crisp, tiny settle) and "fluid" (Windows Fluent style: longer, smoother, layered). Use when adding animation, transitions, press feedback, list entrances, "make it smooth/alive", or when a screen feels static or jumpy. Pairs with ui-polish.
---

# motion

Rule: **nothing changes instantly without a reason.** Every appear, disappear, reorder, press and value change gets motion, but motion must be fast enough that the user never waits for it.

## Pick a feel (default: mac)
| | mac (default) | fluid |
|---|---|---|
| Feel | Quick, soft start, crisp stop, a hair of spring | Longer, smooth, layered, depth |
| Enter | 220 ms, spring (damping ~20, stiffness ~220), no visible overshoot | 320 ms ease-out cubic-bezier(0.1, 0.9, 0.2, 1) |
| Exit | 140 ms ease-in, fade + 4px move | 200 ms ease-in |
| Press | scale 0.97 in 90 ms, release spring | opacity 0.85 + scale 0.985, 120 ms |
| Stagger | 30 ms per item, cap 6 items | 50 ms per item, cap 8 |
| Distance | 8-12 px translate | 16-24 px translate |

Never mix feels in one app. State which one you picked.

## What to animate (checklist)
1. **Screen/content enter:** fade + small translateY, staggered by group, not per word.
2. **Press:** every tappable gets scale/opacity feedback, always.
3. **Selection change** (tabs, chips, toggles): the indicator slides to the new place instead of jumping.
4. **Layout change** (expand, add/remove list row): animate height/position (`LayoutAnimation` on RN, or Reanimated `layout`).
5. **Numbers/progress:** count or fill to the value, do not snap.
6. **Feedback:** success/error get a short, clear cue (a 200 ms nudge or colour fade), not a bounce.

## Rules
- Animate `transform` and `opacity` only; use `useNativeDriver: true`. Never animate width/height/top/left per frame on JS.
- Interruptible: a new action cancels and redirects the running animation from its current value.
- Respect reduced motion: if `AccessibilityInfo.isReduceMotionEnabled()`, drop to opacity-only, <= 100 ms.
- Total perceived delay: nothing blocking over 300 ms; content must be tappable during the entrance.
- One motion token file (durations, easing, spring, stagger). Components import tokens; no magic numbers in screens.
- Do not animate everything at once: one lead element, the rest follow. Large looping or decorative motion is off by default.

## Expo/RN implementation
Prefer built-in `Animated` + `Easing` for simple cases (no new dependency). Use `react-native-reanimated` only when the project already has it or gestures/layout animation demand it; install with `npx expo install`. Check the Expo SDK docs for the installed major version before writing code.

## Verify
Motion cannot be judged from a still. Run on web (`expo start --web`) with Playwright, record frames at 0 / 100 / 200 / 400 ms (or `recordVideo`), and check: starts immediately, no jump on the first frame, settles without wobble, final frame equals the static layout. Report what you saw.
