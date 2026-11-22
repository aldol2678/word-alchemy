# Word Alchemy (단어연금술)

A Korean word-combination alchemy game. Combine words to discover new words, collect spirits, and win back the stars from the silent wizard.

Play live: https://wordalchemy.aldol.app/

## What changed during the Global AI Builder's Challenge (Nov 21–28, 2026)

This submission adds the **AI Tutor ("Momo Tutor")** to the existing game:

- When a combination succeeds, Momo explains *why* it works in 1–2 sentences — for all 76 story combinations (59 regular + 17 homonyms).
- "Momo's Recommendations" suggests 3 combinations to try next (ingredients + result category only — the answer is yours to discover).
- The explanations were reviewed by two AI models (Gemini 4 Carbon, then Gemini 4 Neon) and adjudicated by a person: 38 of 76 rewritten. See `docs/tutor-review.md` for the full before/after list.

## How to play

- Pick two words and combine them to create a new word. (e.g. 물 water + 불 fire = 증기 steam)
- Discovered words become spirits in your collection. (235 combinations in total)
- Clear each stage's goal to move on to the next chapter. (31 adventure stages)
- There are also homonym combinations (e.g. 눈 eye/snow, 배 pear/boat) — pick the meaning you intended.

## AI Tutor (Momo Tutor)

- When a combination succeeds, Momo explains *why* it works in 1–2 sentences. (76 story combinations)
- "Momo's Recommendations" suggests 3 combinations to try next. (The answer is yours to discover!)
- The explanations are bundled in the game as reviewed text — there is no live AI call while playing, so the tutor works offline with no API key.

## Tech

- A single-file HTML + JavaScript game with no build step. Images are external WebP files.
- Run locally: serve this folder with any static server. (e.g. `python3 -m http.server`, then open `http://localhost:8000/`)
- A service worker (`sw.js`) provides offline caching.
- Live deployment: Cloudflare Pages.
- The versus (multiplayer) mode connects to a Cloudflare Worker; single-player play needs no server.

## Credits

- Game: ALDOL Studio (Aldol / 최지석)
- Spirit art: Duri (AI-generated images)
- AI Tutor explanations: AI-generated text (in Momo's voice), reviewed by two AI models and a person — see `docs/tutor-review.md`

## License

MIT — see LICENSE.
