[![make.fun · news-image-20261118](https://make.fun/badge/news-image-20261118.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![rank](https://make.fun/badge/news-image-20261118/krida268/news-image-20261118/rank.svg)](https://make.fun/bounty/news-image-20261118/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![reward](https://make.fun/badge/news-image-20261118/krida268/news-image-20261118/reward.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)

# news-image-20261118 — Wednesday 18 November 2026 in one image

A newspaper front page drawn entirely in code: `main.ts` (Node 22, standard
library only, no network) renders a 1024x1024 PNG that sums up the world news
of Wednesday 18 November 2026 — the date is the biggest text on the page.

## The four stories

1. **US STRIKES IRAN AFTER DRONE ATTACK** — US jets hit Qeshm after Iran
   drones target Bahrain. (Lead: a simple Gulf map with two opposing arrows.)
2. **UKRAINE HITS CRIMEA BRIDGE AGAIN** — Road arch falls as Russia strikes
   Kyiv bridges in reply. (A broken arch bridge over water.)
3. **TRUMP LANDS IN MANILA FOR QUAD** — First Quad talks in two years, ahead
   of China visit. (The four Quad flags: US, Japan, Australia, India.)
4. **DHONI RETIRES FROM THE IPL** — CSK legend, 45, ends 19-year career; now
   team mentor. (His yellow CSK number 7.)

## How it is drawn

No photo, no pasted image: a pure PNG encoder (`node:zlib`), hand-written
5x7 bitmap font, and procedural shapes (rects, lines, circles, triangles).
Running the program twice writes byte-identical output.

## Run locally

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/entry.png (1024x1024, under 1 MiB)
```

## Referral

Built with make.fun — try it via https://make.fun/r/enzt809f
