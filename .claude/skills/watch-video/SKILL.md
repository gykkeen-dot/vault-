---
name: watch-video
description: Watch public short videos (TikTok and similar) by opening them in headless Chromium, playing them, and saving frames, caption text and related-video links, so the user never has to send screenshots. Use whenever the user shares a video link (TikTok, Reels, Shorts), asks to look at outfits or looks from a video, or asks for "similar" videos.
---

# watch-video

Use this skill **every time** the user gives a video link or asks to find and view similar videos. Do not ask the user for screenshots first: run the scripts, look at the frames, then describe what you saw.

## Steps

1. Run (needs `playwright`, already installed globally in cloud sessions; set `NODE_PATH=$(npm root -g)`):
   ```
   node .claude/skills/watch-video/scripts/watch.js <video-url> <out-dir> [frames=8]
   ```
   Use an out-dir in the scratchpad. It saves `frame-NN.png`, `meta.json` (caption, duration, page text, related video links, blocked hosts).
2. Build one contact sheet per video so a whole clip is a single image:
   ```
   .claude/skills/watch-video/scripts/sheet.sh <out-dir> <sheet.png> [cols=3]
   ```
   Then Read the sheet. Use 6 frames per user-provided link, 4 per "similar" video. Several videos can run in parallel (groups of 5).
3. For "similar" videos use `related` in `meta.json`. Prefer other videos by the same creator, then fashion-looking accounts. Many suggestions are random or music edits; skip them after reading the caption.
4. Describe what you see in your own words: pieces, colours, silhouette, textures, layering, accessories. Hashtags and on-screen text count as evidence for brands; never state a brand as fact when it is only a guess.

## Network

Cloud sessions block unknown hosts. TikTok needs these allowed in the session environment (use `update_environment`; the user approves): `www.tiktok.com`, `v16-webapp-prime.us.tiktok.com`, `p16-common-sign.tiktokcdn-us.com`, `p19-common-sign.tiktokcdn-us.com`, `lf16-tiktok-web.tiktokcdn-us.com`, `lf16-tiktok-web.ttwstatic.com`, `lf16-cdn-tos.tiktokcdn-us.com`, `sf16-sg.tiktokcdn.com`, `sf16-website-login.neutral.ttwstatic.com`, `mssdk.tiktokw.us`, `libraweb.tiktokw.us`. If `meta.json` lists `blockedHosts` that look like video or script hosts, request them and retry. Telemetry hosts (`mcs`, `mon16`, `libra16`) can stay blocked.

## Rules

- Public pages only. No logins, no cookies, no bypassing walls. If a video does not load (`No <video> element`), say so and move on.
- Do not identify real people from their faces or guess who they are. Talk about clothes and style only.
- Store descriptions and rules, never the frames or the videos, in the project (`data/looks/`). Keep the source link as a reference.
- Frames and sheets are temporary: keep them in the scratchpad, not in git.
