// wordalchemy-battle-test — 단어연금술 실시간 대전 라우터 (Worker).
// 방 1개 = Durable Object BattleRoom 1개. 게임 본체와 분리된 테스트 워커다.
import { BattleRoom, CODE_ALPHABET } from "./room.js";
import { GAME_VERSION, INF_HASH, INF_HASH_SHORT } from "./battle-data.js";
import { todayKSTStr } from "./battle-data.js";

export { BattleRoom };

const RATE_LIMIT = 5; // 방 생성: IP당 분 5개 (프로토타입: 워커 격리 메모리기반)
const RATE_WINDOW_MS = 60_000;
const hits = new Map(); // ip -> [ts, ...]

function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_LIMIT) {
    hits.set(ip, arr);
    return true;
  }
  arr.push(now);
  hits.set(ip, arr);
  return false;
}

function genCode() {
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  let code = "";
  for (const b of buf) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return code;
}

function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}
function corsHeaders(request) {
  // 프로토타입: 게임 도메인·로컬 테스트에서 부른다. 라이브 때는 게임 오리진만 허용으로 좁힐 것.
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    const cors = corsHeaders(request);

    if (url.pathname === "/" && request.method === "GET") {
      return json({ ok: true, service: "wordalchemy-battle-test", version: GAME_VERSION, infHash: INF_HASH_SHORT }, 200, cors);
    }

    if (url.pathname === "/room/create" && request.method === "POST") {
      const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
      if (rateLimited(ip)) {
        return json({ error: "rate-limited", message: "방 만들기가 너무 잦아요. 잠시 뒤 다시 시도해주세요." }, 429, cors);
      }
      let body = {};
      try { body = await request.json(); } catch (e) { /* 빈 본문 허용 */ }
      if (body.gameVersion && body.gameVersion !== GAME_VERSION) {
        return json({ error: "version-mismatch", message: "게임을 새로고침해 최신 버전을 받아주세요." }, 409, cors);
      }
      if (body.infHash && body.infHash !== INF_HASH_SHORT && body.infHash !== INF_HASH) {
        return json({ error: "version-mismatch", message: "게임을 새로고침해 최신 버전을 받아주세요." }, 409, cors);
      }
      // 코드 충돌은 사실상 불가능하지만, init이 409면 한 번만 다시 뽑는다.
      // v1.2: maxPlayers 2..8 클램프, 기본 8.
      let maxPlayers = 8;
      if (body.maxPlayers !== undefined && body.maxPlayers !== null) {
        const n = Number(body.maxPlayers);
        maxPlayers = Number.isFinite(n) ? Math.max(2, Math.min(8, Math.floor(n))) : 8;
      }
      // v1.3 정정: 명시적 mode + 방장 설정을 그대로 DO에 전달한다.
      // 검증·기본값 적용은 DO(__init__)가 한다. 응답은 DO가 확정한 값을 그대로 쓴다.
      const initBody = {
        code: null, dateStr: todayKSTStr(), maxPlayers,
        mode: body.mode, totalRounds: body.totalRounds,
        roundLimitMin: body.roundLimitMin, finishWindowSec: body.finishWindowSec,
      };
      for (let attempt = 0; attempt < 2; attempt++) {
        const code = genCode();
        const id = env.BATTLE_ROOM.idFromName("room:" + code);
        const stub = env.BATTLE_ROOM.get(id);
        const init = await stub.fetch(new Request("http://internal/__init__", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...initBody, code }),
        }));
        if (init.ok) {
          const created = await init.json().catch(() => ({}));
          // v1.3 정정: 생성 응답에 mode + settings를 실어 클라이언트가 방 만들기
          // 직후 맞는 로비로 바로 라우팅할 수 있게 한다.
          return json({
            code,
            inviteUrl: "https://wordalchemy.aldol.app/?battle=" + code,
            wsUrl: url.origin + "/room/" + code + "/ws",
            maxPlayers: created.maxPlayers ?? maxPlayers,
            mode: created.mode ?? null,
            settings: created.settings ?? null,
          }, 200, cors);
        }
      }
      return json({ error: "room-exists", message: "방 만들기에 실패했어요. 다시 시도해주세요." }, 409, cors);
    }

    const m = url.pathname.match(/^\/room\/([A-Z0-9]{6})\/(ws|status)$/);
    if (m) {
      const code = m[1];
      const id = env.BATTLE_ROOM.idFromName("room:" + code);
      const stub = env.BATTLE_ROOM.get(id);
      if (m[2] === "status") {
        const res = await stub.fetch(new Request("http://internal/__status__"));
        const text = await res.text();
        return new Response(text, { status: res.status, headers: { "Content-Type": "application/json", ...cors } });
      }
      return stub.fetch(request);
    }

    return json({ error: "not-found" }, 404, cors);
  },
};
