# Versus server — wordalchemy-battle-test

Word Alchemy's realtime versus (multiplayer) mode runs on this Cloudflare Worker.
Live endpoint: `https://wordalchemy-battle-test.aldol-lab.workers.dev/`

## Files

| File | What it is |
|---|---|
| `worker.js` (124 lines) | Router. One room = one `BattleRoom` Durable Object. IP rate limit: 5 room creations per minute. |
| `room.js` (1,058 lines) | `BattleRoom` Durable Object. WebSocket hibernation API, server-side validation, alarm queue. |
| `battle-data.js` (400 lines) | **GENERATED — do not edit by hand.** Built by `extract-battle-data.py` from the game's index.html v5.5. INF_COMBOS + COMBOS + date engine. |
| `wrangler.toml` | **DRAFT.** Reconstructed from the code (the recovered bundle had no deploy config). Verify `compatibility_date` and the migration tag before deploying to the live worker. |

## Provenance

Recovered 2026-11-23 from Cloudflare's API: the deployed worker bundle + source map were
downloaded and the three original source files were restored (`sourcesContent` cross-checked
against the bundle). Secret scan: no API keys, tokens, or passwords — safe to publish.

## Deploy

```sh
cd server
npx wrangler deploy
```

`battle-data.js` is generated data. Its generator (`extract-battle-data.py`) was not part of
the recovered bundle — if the game data changes, the generator needs to be found or rebuilt
before regenerating this file.

## Notes

- CORS is wide open (`*`) in this prototype. The code itself notes it should be narrowed to
  the game origin for the live service.
- The deployed bundle (`worker.bundle.js`, 89,959B) is a build artifact and is kept only in
  the local recovery record, not in this folder.
