// BattleRoom — 단어연금술 실시간 대전 방 (Durable Object, 1방 = 1객체).
// 설계 pvp-design-v1.md v1.1 기준: 3전 2선승, 스테이지마다 서버가 주제어 랜덤 뽑기,
// WebSocket hibernation API, 서버 검증, 알람 큐(단일 알람 슬롯 다중화).
import {
  GAME_VERSION, INF_HASH, INF_HASH_SHORT, INF_COMBOS, COMBOS,
  dailyComboPath, battlePickTarget, todayKSTStr,
} from "./battle-data.js";

export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 0/O, 1/I/L 제외 32자
const COUNTDOWN_MS = 3000;
const ROUND_MS = 10 * 60 * 1000; // 스테이지 제한 10분
const FINISH_WINDOW_MS = 60_000; // 포인트제: 첫 클리어 후 60초 마감 (v1.2)
const INTER_ROUND_MS = 5000;
const RECONNECT_GRACE_MS = 30_000;
const ROOM_EXPIRE_MS = 10 * 60 * 1000; // 생성 후 10분간 2명 안 모이면 만료
const DELETE_AFTER_FINISH_MS = 5 * 60 * 1000;
const WINS_TO_WIN = 2;
const POINTS_TOTAL_ROUNDS = 5; // 포인트제 라운드 수 (v1.2)
const MATCH_RESULT_DELAY_MS = 2000; // 결승 스테이지: 라운드 결과를 2초 보여준 뒤 판 결과 (2026-11-15 수정)
const SLOTS = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"]; // v1.2: 최대 8인
const POINTS_BY_RANK = { 1: 10, 2: 8, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 }; // v1.2: 순위별 라운드 점수

// 조합 조회: [a,b].sort().join("+") -> 항목.
// 대전 허용 집합은 INF_COMBOS ∪ COMBOS (버그 5: 물+흙=진흙은 COMBOS에만 있다).
// 같은 쌍이 양쪽에 있으면 INF_COMBOS를 우선한다 — 본편 무한 합성의 infCombine도
// findInfCombo를 먼저 보고 없으면 findCombo로 폴백한다. 유일한 충돌 쌍은
// 돌+흙으로, INF(언덕)가 COMBOS(지진)보다 우선한다.
// SENSE_COMBOS(17개)는 전부 의미 태그(#) 키라 평문 단어만 오가는 대전 프로토콜로는
// 시도 자체가 불가능해 포함하지 않는다.
// 소유 검사는 별도(재료 6개 + 발견한 단어)라, 당일 재료로 만들 수 없는
// COMBOS 조합(예: 철이 없는 날의 불+철=검)은 owned 검사에서 걸러진다.
const COMBO_BY_PAIR = new Map();
for (const c of [...INF_COMBOS, ...COMBOS]) {
  const k = [c.a, c.b].sort().join("+");
  if (!COMBO_BY_PAIR.has(k)) COMBO_BY_PAIR.set(k, c);
}

// 대전 조합 조회 (순수 함수 — 단위 테스트용). 없으면 null.
export function findBattleCombo(a, b) {
  return COMBO_BY_PAIR.get([a, b].sort().join("+")) || null;
}

function freshRoundPlayer() {
  return { found: [], tried: 0, clearedAt: null, ms: null, points: 0, rank: null, clearMs: null, forfeited: false };
}
function sanitizeNick(nick) {
  if (typeof nick !== "string") return null;
  const n = nick.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 12);
  return n || null;
}

// ---- patch35-server: 대전 닉네임 금지어 검사 (클라이언트 patch35와 동일 목록·동일 정규화) ----
// 클라이언트 검사를 우회해 웹소켓으로 직접 join을 보내도, 서버가 여기서 거부한다.
// 목록을 바꿀 때는 클라이언트(~/workspace/deploy/word-alchemy/index.html, BATTLE_NICK_BANNED)
// 와 이 파일을 함께 바꿀 것. bare "년"은 소년·청년 등 정상 단어 오탐 때문에 목록에서 뺐다.
export const BATTLE_NICK_BANNED = [
  "씨발", "시발", "시바", "씨바", "썅", "병신", "지랄", "개새끼", "개새", "개년",
  "새끼", "좆", "좃", "씹", "자지", "보지", "엿", "닥쳐", "꺼져", "죽어", "뒤져",
  "미친년", "미친놈", "ㅅㅂ", "ㅆㅂ", "ㅂㅅ", "ㅈㄹ",
  "섹스", "야동", "포르노", "자위", "음란",
  "쪽바리", "짱깨", "김치녀", "된장녀", "한남충",
  "fuck", "shit", "bitch", "cunt", "dick", "pussy", "whore", "slut", "bastard", "asshole",
];
export function normalizeNickForFilter(s) {
  let v = String(s || "").normalize("NFKC").toLowerCase();
  v = v.replace(/1/g, "i").replace(/0/g, "o").replace(/@/g, "a").replace(/\$/g, "s");
  v = v.replace(/[\s\-_.,~^*!?·•…]+/g, "");
  v = v.replace(/(.)\1+/g, "$1");
  return v;
}
export function nickHasBanned(nick) {
  const v = normalizeNickForFilter(nick);
  if (!v) return false;
  return BATTLE_NICK_BANNED.some((w) => v.includes(w));
}

// ---- v1.2 순수 함수 (DO 상태 없이 단위 테스트 가능) ----
// 라운드 순위표: 클리어자는 clearMs(라운드 시작からの 경과 ms) 오름차순,
// 미클리어는 그 아래로 pathStep 내림차순·tried 오름차순.
// 같은 clearMs(같은 ms)면 순위·점수 공유, 다음 순위 건너뜀
// (standard competition ranking). 미클리어는 점수 0, 같은
// (pathStep, tried)면 순위 공유.
export function computeRanks(entries) {
  const finishers = entries.filter((e) => e.cleared)
    .sort((a, b) => (a.clearMs - b.clearMs) || (a.slot < b.slot ? -1 : 1));
  const rest = entries.filter((e) => !e.cleared)
    .sort((a, b) => (b.pathStep - a.pathStep) || (a.tried - b.tried) || (a.slot < b.slot ? -1 : 1));
  const out = [];
  let rank = 0;
  for (let i = 0; i < finishers.length;) {
    let j = i + 1;
    while (j < finishers.length && finishers[j].clearMs === finishers[i].clearMs) j++;
    rank = i + 1;
    for (let k = i; k < j; k++) {
      const e = finishers[k];
      out.push({ slot: e.slot, nick: e.nick, rank, points: POINTS_BY_RANK[rank] || 0, clearMs: e.clearMs, pathStep: e.pathStep, tried: e.tried, found: e.found });
    }
    i = j;
  }
  const base = finishers.length;
  for (let i = 0; i < rest.length;) {
    let j = i + 1;
    while (j < rest.length && rest[j].pathStep === rest[i].pathStep && rest[j].tried === rest[i].tried) j++;
    rank = base + i + 1;
    for (let k = i; k < j; k++) {
      const e = rest[k];
      out.push({ slot: e.slot, nick: e.nick, rank, points: 0, clearMs: null, pathStep: e.pathStep, tried: e.tried, found: e.found });
    }
    i = j;
  }
  return out;
}

// 최종 순위: 총점 내림차순 → 라운드 승리 수(1위 횟수) 내림차순 → 총 시도 수
// 오름차순 → 마지막 클리어 시각(lastClearMs, 서버 epoch ms) 오름차순
// (한 번도 안 클리어했으면 없음으로 마지막). 4개 키가 전부 같으면 순위 공유.
export function computeStandings(entries) {
  const sorted = entries.slice().sort((a, b) =>
    (b.points - a.points) || (b.roundWins - a.roundWins) || (a.tried - b.tried) ||
    ((a.lastClearMs ?? Infinity) - (b.lastClearMs ?? Infinity)) ||
    (a.slot < b.slot ? -1 : 1));
  const sameKeys = (a, b) => a.points === b.points && a.roundWins === b.roundWins &&
    a.tried === b.tried && (a.lastClearMs ?? null) === (b.lastClearMs ?? null);
  const out = [];
  for (let i = 0; i < sorted.length;) {
    let j = i + 1;
    while (j < sorted.length && sameKeys(sorted[j], sorted[i])) j++;
    const rank = i + 1;
    for (let k = i; k < j; k++) {
      const e = sorted[k];
      out.push({ slot: e.slot, nick: e.nick, rank, points: e.points, roundWins: e.roundWins, tried: e.tried, lastClearMs: e.lastClearMs ?? null });
    }
    i = j;
  }
  return out;
}

export class BattleRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.state = null;
    this.ready = ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get("state")) || null;
    });
  }

  // ---------- 저장 ----------
  async save() {
    await this.ctx.storage.put("state", this.state);
  }

  // ---------- 알람 큐 (DO 알람은 1개뿐이라, 큐에서 가장 이른 것을 건다) ----------
  rearm() {
    const alarms = (this.state && this.state.alarms) || [];
    const next = alarms.slice().sort((a, b) => a.at - b.at)[0];
    if (next) return this.ctx.storage.setAlarm(next.at);
    return this.ctx.storage.deleteAlarm().catch(() => {});
  }
  async scheduleAlarm(kind, at, extra = {}) {
    if (!this.state) return;
    this.state.alarms = (this.state.alarms || []).filter((a) => a.kind !== kind || (extra.slot && a.slot !== extra.slot));
    this.state.alarms.push({ kind, at, ...extra });
    await this.save();
    await this.rearm();
  }
  async cancelAlarm(kind, pred) {
    if (!this.state) return;
    const before = (this.state.alarms || []).length;
    this.state.alarms = (this.state.alarms || []).filter((a) => !(a.kind === kind && (!pred || pred(a))));
    if (this.state.alarms.length !== before) {
      await this.save();
      await this.rearm();
    }
  }

  async alarm() {
    await this.ready;
    if (!this.state) return;
    const now = Date.now();
    const due = ((this.state.alarms || []).filter((a) => a.at <= now)).sort((a, b) => a.at - b.at);
    if (!due.length) {
      await this.rearm();
      return;
    }
    this.state.alarms = (this.state.alarms || []).filter((a) => a.at > now);
    await this.save();
    for (const a of due) await this.handleAlarm(a, now);
    await this.save();
    await this.rearm();
  }

  async handleAlarm(a, now) {
    if (!this.state) return;
    switch (a.kind) {
      case "round-start": {
        if (this.state.phase !== "countdown" || !this.state.roundState) return;
        this.state.phase = "playing";
        this.state.roundState.startAt = now;
        // v1.3 정정: 스테이지 제한은 방장 설정(roundLimitMs, 기본 10분).
        const limitMs = this.state.roundLimitMs ?? ROUND_MS;
        this.state.roundState.deadlineAt = now + limitMs;
        await this.scheduleAlarm("round-timeout", now + limitMs);
        this.broadcast({ type: "round-start", round: this.state.round, startedAt: now, deadlineAt: now + limitMs });
        this.broadcast(this.publicRoom(null));
        break;
      }
      case "round-timeout": {
        if (this.state.phase !== "playing" || !this.state.roundState) return;
        if (this.state.mode === "points") {
          await this.endRound(null, "timeout");
          break;
        }
        // 클래식: 시도 수 적은 쪽 승리, 동수면 무승부 (전 슬롯 일반화).
        const rs = this.state.roundState;
        let best = null, winner = null;
        for (const s of Object.keys(rs.p)) {
          const t = rs.p[s].tried;
          if (best === null || t < best) { best = t; winner = s; }
          else if (t === best) { winner = null; }
        }
        await this.endRound(winner, "timeout");
        break;
      }
      case "finish-window": {
        // 포인트제: 첫 클리어 후 마감 창(방장 설정, 기본 60초) 경과 시 라운드 종료.
        // 낡은 알람(이전 라운드 것)은 무시한다.
        if (this.state.phase !== "playing" || !this.state.roundState || this.state.mode !== "points") return;
        if (a.round && a.round !== this.state.round) return;
        await this.endRound(null, "finish-window");
        break;
      }
      case "reconnect-grace": {
        const pl = this.state.players[a.slot];
        if (!pl || pl.connected) return;
        // patch29: 유예 만료 시점에 같은 playerId의 소켓이 살아 있으면
        // 이미 재접속된 것으로 본다 (중복 접속 정리 레이스 대비).
        const live = [...this.ctx.getWebSockets()].some((s) => {
          const at = this.attachment(s);
          return at && at.playerId === pl.playerId;
        });
        if (live) {
          pl.connected = true;
          pl.disconnectedAt = null;
          await this.save();
          this.broadcast(this.publicRoom(null));
          return;
        }
        pl.left = true; // v1.2: 유예 만료 시 이탈로 표시 (재접속하면 해제)
        await this.save();
        await this.handlePlayerLeft(a.slot);
        break;
      }
      case "next-round": {
        if (this.state.phase !== "round-end") return;
        await this.startCountdown();
        break;
      }
      case "match-result": {
        // 결승 스테이지: 라운드 결과를 2초 보여준 뒤 판 결과를 보낸다.
        // (즉시 보내면 라운드 결과 화면이 한 프레임만 깜빡이고 사라졌다.)
        if (this.state.phase !== "round-end" || !this.state.pendingMatch) return;
        const pm = this.state.pendingMatch;
        this.state.pendingMatch = null;
        await this.endMatch(pm.winner, pm.reason);
        break;
      }
      case "expire": {
        if (this.state.phase === "waiting" && this.playerCount() < 2) {
          await this.deleteRoom("expired");
        }
        break;
      }
      case "delete": {
        // patch29: 전원 끊겼을 때 건 알람이라도, 그 사이 누군가 재접속해
        // 살아 있으면 삭제하지 않는다 (재접속은 delete 알람을 취소하지 않아
        //  5분 뒤 살아 있는 방이 지워지는 것을 막는다).
        // 판 종료 후 5분 정리(phase finished)는 기존대로 삭제한다.
        const anyoneConnected = Object.values(this.state.players || {}).some((p) => p.connected);
        if (anyoneConnected && this.state.phase !== "finished") return;
        await this.deleteRoom("finished");
        break;
      }
      default:
        break;
    }
  }

  async deleteRoom(reason) {
    this.broadcast({ type: "error", code: "room-closed", message: reason === "expired" ? "상대가 오지 않아 방이 닫혔어요." : "방이 닫혔어요." });
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.close(1000, "room-closed"); } catch (e) { /* 무시 */ }
    }
    this.state = null;
    await this.ctx.storage.deleteAlarm().catch(() => {});
    await this.ctx.storage.deleteAll();
  }

  // ---------- HTTP (Worker가 전달) ----------
  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/__init__" && request.method === "POST") {
      if (this.state) return new Response(JSON.stringify({ error: "room-exists" }), { status: 409, headers: { "Content-Type": "application/json" } });
      const body = await request.json().catch(() => ({}));
      const code = body.code || "";
      // v1.2: maxPlayers 2..8 클램프, 기본 8.
      let maxPlayers = 8;
      if (typeof body.maxPlayers === "number" && Number.isFinite(body.maxPlayers)) {
        maxPlayers = Math.max(2, Math.min(8, Math.floor(body.maxPlayers)));
      }
      // v1.3 정정: 방 타입은 생성 요청의 명시적 mode로 정한다 ("classic"|"points").
      // mode가 없거나 유효하지 않으면 maxPlayers에서 유도한다 (2→classic, ≥3→points)
      // — 구버전 클라이언트·기존 테스트 호환용 폴백. mode와 maxPlayers의 조합은
      // 강제하지 않는다 (메뉴는 classic/maxPlayers=2, points/maxPlayers=8을 쓴다).
      const mode = (body.mode === "classic" || body.mode === "points")
        ? body.mode
        : (maxPlayers === 2 ? "classic" : "points");
      // v1.3 정정: 방장 설정 (생성 시에만 정함, 대기실 변경 없음).
      // 허용 집합 밖 값은 기본값으로 대체한다 (가장 가까운 허용값이 아니라 기본값).
      // - totalRounds: points 3/5/7 (기본 5). classic은 3 고정 (요청값 무시).
      // - roundLimitMin: 5/10분 (기본 10). 양쪽 모드 모두 적용 (스테이지 제한).
      // - finishWindowSec: points 30/60초 (기본 60). classic은 마감 창이 없어 null.
      // 순위 점수표(10/8/6/5/4/3/2/1)는 고정 — 방장 설정 대상 아님.
      const totalRounds = mode === "classic" ? 3
        : ([3, 5, 7].includes(body.totalRounds) ? body.totalRounds : POINTS_TOTAL_ROUNDS);
      const roundLimitMin = ([5, 10].includes(body.roundLimitMin)) ? body.roundLimitMin : 10;
      const finishWindowSec = mode === "classic" ? null
        : ([30, 60].includes(body.finishWindowSec) ? body.finishWindowSec : 60);
      this.state = {
        code,
        dateStr: body.dateStr || todayKSTStr(),
        createdAt: Date.now(),
        phase: "waiting",
        matchNo: 1,
        round: 0,
        maxPlayers,
        mode, // v1.3 정정: 생성 시 명시, 카운트다운·재대결은 다시 결정하지 않음
        totalRounds,
        roundLimitMs: roundLimitMin * 60 * 1000, // v1.3 정정: 스테이지 제한 (기본 10분)
        finishWindowMs: finishWindowSec === null ? null : finishWindowSec * 1000, // v1.3 정정: 첫 클리어 후 마감 창 (기본 60초, classic은 null)
        roundWins: { p1: 0, p2: 0 },
        players: {},
        roundState: null,
        rounds: [],
        matchWinner: null,
        pendingMatch: null,
        alarms: [],
      };
      await this.save();
      await this.scheduleAlarm("expire", Date.now() + ROOM_EXPIRE_MS);
      return new Response(JSON.stringify({ ok: true, code, maxPlayers, mode, settings: this.settingsOf() }), { headers: { "Content-Type": "application/json" } });
    }
    if (path === "/__status__") {
      if (!this.state) return new Response(JSON.stringify({ error: "room-not-found" }), { status: 404, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify(this.publicRoom(null)), { headers: { "Content-Type": "application/json" } });
    }
    if (path.endsWith("/ws")) {
      const upgrade = request.headers.get("Upgrade");
      if (!upgrade || upgrade.toLowerCase() !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }
      if (!this.state) {
        return new Response(JSON.stringify({ error: "room-not-found" }), { status: 404, headers: { "Content-Type": "application/json" } });
      }
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({ playerId: null });
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    return new Response(JSON.stringify({ error: "not-found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  // ---------- 소켓 유틸 (hibernation 안전: attachment에 playerId 저장) ----------
  attachment(ws) {
    try { return ws.deserializeAttachment(); } catch (e) { return null; }
  }
  socketFor(slot) {
    const want = this.state && this.state.players[slot] ? this.state.players[slot].playerId : null;
    if (!want) return null;
    for (const ws of this.ctx.getWebSockets()) {
      const att = this.attachment(ws);
      if (att && att.playerId === want) return ws;
    }
    return null;
  }
  sendSocket(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch (e) { /* 끊긴 소켓 */ }
  }
  sendTo(slot, obj) {
    const ws = this.socketFor(slot);
    if (ws) this.sendSocket(ws, obj);
  }
  broadcast(obj) {
    const s = JSON.stringify(obj);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(s); } catch (e) { /* 끊긴 소cket */ }
    }
  }

  playerCount() {
    return this.state ? Object.keys(this.state.players).length : 0;
  }
  slotOf(playerId) {
    if (!this.state) return null;
    for (const [slot, p] of Object.entries(this.state.players)) {
      if (p.playerId === playerId) return slot;
    }
    return null;
  }
  // v1.2: 활성 슬롯 = 참가했고 이탈하지 않은 슬롯 (joined && !left).
  activeSlots() {
    if (!this.state) return [];
    return Object.keys(this.state.players).filter((s) => !this.state.players[s].left);
  }
  otherActiveSlot(slot) {
    return this.activeSlots().find((s) => s !== slot) || null;
  }
  pathStepOf(slot) {
    const rs = this.state && this.state.roundState;
    if (!rs || !rs.path || !rs.p[slot]) return 0;
    const found = rs.p[slot].found;
    return rs.path.filter((step) => found.includes(step.result)).length;
  }

  // v1.3 정정: 방 설정을 로비·대기실 표시용 단위로 반환한다.
  // classic은 finishWindowSec이 null (마감 창 없음).
  settingsOf() {
    const st = this.state;
    if (!st) return null;
    return {
      totalRounds: st.totalRounds ?? (st.mode === "classic" ? 3 : POINTS_TOTAL_ROUNDS),
      roundLimitMin: Math.round((st.roundLimitMs ?? ROUND_MS) / 60000),
      finishWindowSec: st.mode === "classic" ? null : Math.round((st.finishWindowMs ?? FINISH_WINDOW_MS) / 1000),
    };
  }

  // 방 전체 상태. viewerSlot이 있으면 그 플레이어의 보유 단어까지 포함 (본인 것만).
  publicRoom(viewerSlot) {
    const st = this.state;
    const rs = st.roundState;
    const out = {
      type: "room",
      code: st.code,
      phase: st.phase,
      matchNo: st.matchNo,
      round: st.round,
      maxPlayers: st.maxPlayers ?? 8, // v1.2
      mode: st.mode ?? null, // v1.3 정정: "classic"|"points", 생성 시 명시 — 대기실부터 non-null
      totalRounds: st.totalRounds ?? null, // v1.3 정정: 3/5/7, 생성 시 고정
      settings: this.settingsOf(), // v1.3 정정: {totalRounds, roundLimitMin, finishWindowSec} — classic은 finishWindowSec null
      roundWins: { ...st.roundWins },
      reconnectGraceMs: RECONNECT_GRACE_MS, // patch29: 재접속 유예(30초) — 클라이언트 표시용
      players: Object.values(st.players).map((p) => ({
        id: p.id, nick: p.nick, ready: p.ready, connected: p.connected, rematch: !!p.rematch,
        points: p.points || 0, left: !!p.left, // v1.2
        // patch29: '나감'과 '연결 끊김(재접속 대기)' 구분용.
        // reconnecting = connected=false·left=false (30초 유예 중),
        // reconnectBy = 유예 만료 시각(epoch ms). left면 null.
        presence: p.left ? "left" : (p.connected ? "connected" : "reconnecting"),
        reconnectBy: (!p.left && !p.connected && p.disconnectedAt) ? p.disconnectedAt + RECONNECT_GRACE_MS : null,
      })),
      materials: rs ? rs.materials : null,
      target: rs ? rs.target : null,
      par: rs ? rs.par : null,
      deadlineAt: rs ? rs.deadlineAt : null,
      you: null,
    };
    // you는 라운드 전(대기실)에도 항상 포함한다 — 클라이언트가 자기 슬롯을
    // 알아야 자기 진행을 구분할 수 있다. 라운드 전에는 발견 기록이 비어 있다.
    // (2026-11-15 프로토타입 검증에서 발견: 기존에는 rs가 없을 때 you가 null이라
    //  클라이언트의 BT.slot이 null로 남아 자기 progress를 상대 것으로 오인했다.)
    if (viewerSlot && st.players[viewerSlot]) {
      const rp = rs && rs.p[viewerSlot];
      out.you = {
        slot: viewerSlot,
        playerId: st.players[viewerSlot].playerId,
        found: rp ? rp.found.slice() : [],
        tried: rp ? rp.tried : 0,
        pathStep: rp ? this.pathStepOf(viewerSlot) : 0,
        points: st.players[viewerSlot].points || 0, // v1.2
      };
    }
    return out;
  }

  // ---------- WebSocket 핸들러 ----------
  async webSocketMessage(ws, message) {
    await this.ready;
    if (!this.state) {
      this.sendSocket(ws, { type: "error", code: "room-not-found", message: "방을 찾을 수 없어요." });
      return;
    }
    let data;
    try { data = JSON.parse(message); } catch (e) {
      this.sendSocket(ws, { type: "error", code: "bad-message", message: "JSON이 아니에요." });
      return;
    }
    if (data.type === "join") return this.handleJoin(ws, data);
    const att = this.attachment(ws);
    const slot = att && att.playerId ? this.slotOf(att.playerId) : null;
    if (!slot || !this.state.players[slot]) {
      this.sendSocket(ws, { type: "error", code: "not-joined", message: "먼저 입장해주세요." });
      return;
    }
    switch (data.type) {
      case "ready": return this.handleReady(slot);
      case "attempt": return this.handleAttempt(slot, data);
      case "forfeit": return this.handleForfeit(slot);
      case "rematch": return this.handleRematch(slot);
      case "ping": return this.sendTo(slot, { type: "pong", serverNow: Date.now() });
      default:
        return this.sendTo(slot, { type: "error", code: "unknown-type", message: "알 수 없는 메시지예요." });
    }
  }

  async webSocketClose(ws, code, reason, wasClean) {
    await this.ready;
    if (!this.state) return;
    const att = this.attachment(ws);
    const slot = att && att.playerId ? this.slotOf(att.playerId) : null;
    if (!slot || !this.state.players[slot]) return;
    // patch29: 같은 playerId의 다른 소켓이 살아 있으면 이 close는 무시한다.
    // (중복 접속 정리·구 소켓 종료 레이스: 살아 있는 탭이 있는데도
    //  connected=false → 30초 뒤 left=true '나감'으로 오염되는 것을 막는다.
    //  버그 4의 직접 원인 — 두 번째 탭 소켓이 닫힐 때 본 탭까지 나감 처리됐다.)
    const otherLive = [...this.ctx.getWebSockets()].some((s) => {
      if (s === ws) return false;
      const a = this.attachment(s);
      return a && a.playerId === att.playerId;
    });
    if (otherLive) return;
    const p = this.state.players[slot];
    p.connected = false;
    p.disconnectedAt = Date.now();
    await this.save();
    this.broadcast(this.publicRoom(null));
    await this.scheduleAlarm("reconnect-grace", Date.now() + RECONNECT_GRACE_MS, { slot });
    const connected = Object.values(this.state.players).filter((x) => x.connected).length;
    if (connected === 0) await this.scheduleAlarm("delete", Date.now() + DELETE_AFTER_FINISH_MS);
  }

  async webSocketError(ws, error) {
    await this.webSocketClose(ws, 1011, "error", false);
  }

  // ---------- join / ready ----------
  async handleJoin(ws, data) {
    // 버전 핸드셰이크 (§6.3): 게임 버전·조합 해시가 서버 번들과 다르면 거부.
    const gv = data.gameVersion;
    const ih = data.infHash;
    if (gv !== GAME_VERSION || !ih || (ih !== INF_HASH_SHORT && ih !== INF_HASH)) {
      this.sendSocket(ws, { type: "error", code: "version-mismatch", message: "게임을 새로고침해 최신 버전을 받아주세요." });
      setTimeout(() => { try { ws.close(1008, "version-mismatch"); } catch (e) { /* 무시 */ } }, 100);
      return;
    }
    // patch35-server: 금지 닉네임이면 방에 들여보내지 않고 거부한다.
    // (재접속 경로도 같은 handleJoin을 타므로, 기존 플레이어가 금지 닉네임으로
    //  바꿔서 돌아오는 경우도 여기서 걸러진다. 빈 닉네임은 기존대로 기본값 부여.)
    if (typeof data.nick === "string" && data.nick.trim() && nickHasBanned(data.nick)) {
      this.sendSocket(ws, { type: "error", code: "bad-nick", message: "사용할 수 없는 단어가 들어 있어요. 다른 닉네임을 입력해주세요." });
      setTimeout(() => { try { ws.close(1008, "bad-nick"); } catch (e) { /* 무시 */ } }, 100);
      return;
    }
    const nick = sanitizeNick(data.nick) || ("연금술사" + String(Math.floor(1000 + Math.random() * 9000)));
    const playerId = (typeof data.playerId === "string" && data.playerId) ? data.playerId.slice(0, 64) : crypto.randomUUID();

    // 재접속: 같은 playerId가 이미 있으면 소켓만 갈아낀다.
    const existing = this.slotOf(playerId);
    if (existing) {
      const p = this.state.players[existing];
      // patch29: 중복 접속 — 새 접속을 받고 이전 소켓을 끊는다.
      // (새로고침·재연결이 가장 흔한 경우라 새 접속 거부는 안 된다.
      //  구 소켓을 살려두면 둘 다 브로드캐스트를 받고, 구 소켓이 닫힐 때
      //  살아 있는 플레이어까지 connected=false로 오염시킨다 — 버그 4.
      //  구 소켓에는 사유를 명시해 보내고 1008로 닫는다.
      //  클라이언트는 duplicate-connection을 받으면 자동 재연결을 멈춰야 한다.)
      const oldWs = this.socketFor(existing);
      if (oldWs && oldWs !== ws) {
        this.sendSocket(oldWs, { type: "error", code: "duplicate-connection", message: "다른 탭·기기에서 다시 접속했어요. 이 연결은 끊어졌어요." });
        setTimeout(() => { try { oldWs.close(1008, "duplicate-connection"); } catch (e) { /* 무시 */ } }, 100);
      }
      p.connected = true;
      p.disconnectedAt = null;
      p.left = false; // v1.2: 이탈 표시 해제 (판 중 재접속)
      p.nick = nick;
      ws.serializeAttachment({ playerId });
      await this.save();
      await this.cancelAlarm("reconnect-grace", (a) => a.slot === existing);
      // v1.2: 라운드 시작 전 이탈했다가 판 중 돌아오면 이번 라운드에 합류시킨다.
      if (this.state.roundState && (this.state.phase === "playing" || this.state.phase === "countdown") && !this.state.roundState.p[existing]) {
        this.state.roundState.p[existing] = freshRoundPlayer();
        await this.save();
      }
      this.sendSocket(ws, this.publicRoom(existing));
      this.broadcast(this.publicRoom(null));
      return;
    }
    // v1.2: 판이 시작된 방에는 새로 들어올 수 없다 (재접속은 위에서 처리됨).
    if (this.state.phase !== "waiting") {
      this.sendSocket(ws, { type: "error", code: "already-started", message: "판이 이미 시작했어요." });
      setTimeout(() => { try { ws.close(1008, "already-started"); } catch (e) { /* 무시 */ } }, 100);
      return;
    }
    const maxPlayers = this.state.maxPlayers ?? 8;
    if (this.playerCount() >= maxPlayers) {
      this.sendSocket(ws, { type: "error", code: "room-full", message: "방이 가득 찼어요." });
      setTimeout(() => { try { ws.close(1008, "room-full"); } catch (e) { /* 무시 */ } }, 100);
      return;
    }
    const slot = SLOTS.find((s) => !this.state.players[s]);
    if (!slot) {
      this.sendSocket(ws, { type: "error", code: "room-full", message: "방이 가득 찼어요." });
      setTimeout(() => { try { ws.close(1008, "room-full"); } catch (e) { /* 무시 */ } }, 100);
      return;
    }
    this.state.players[slot] = {
      id: slot, playerId, nick, ready: false, connected: true,
      joinedAt: Date.now(), disconnectedAt: null, rematch: false,
      points: 0, matchTried: 0, lastClearMs: null, left: false, // v1.2
    };
    ws.serializeAttachment({ playerId });
    await this.save();
    if (this.playerCount() >= 2) await this.cancelAlarm("expire");
    this.sendSocket(ws, this.publicRoom(slot));
    this.broadcast(this.publicRoom(null));
  }

  async handleReady(slot) {
    if (this.state.phase !== "waiting") {
      return this.sendTo(slot, { type: "error", code: "not-waiting", message: "지금은 준비할 수 없어요." });
    }
    this.state.players[slot].ready = true;
    await this.save();
    this.broadcast(this.publicRoom(null));
    // v1.3 정정: 시작 조건은 두 모드 모두 활성 2인 이상 + 전원 ready.
    // 다인전(포인트제)도 2명만으로 판이 열린다 ("포인트 방 3명 필요" 규칙 폐기).
    const active = this.activeSlots();
    if (active.length >= 2 && active.every((s) => this.state.players[s].ready)) await this.startCountdown();
  }

  async startCountdown() {
    const round = (this.state.round || 0) + 1;
    this.state.round = round;
    // v1.3 정정: 모드·라운드 수·제한 시간·마감 창은 생성 시 이미 고정돼 있다.
    // 카운트다운은 결정하지 않는다. mode가 없는 방(v1.2 이전에 만든 방)만
    // maxPlayers에서 유도한다.
    if (!this.state.mode) {
      this.state.mode = (this.state.maxPlayers ?? 8) === 2 ? "classic" : "points";
      this.state.totalRounds = this.state.mode === "points" ? POINTS_TOTAL_ROUNDS : 3;
    }
    const pick = battlePickTarget(this.state.code, this.state.matchNo, round, this.state.dateStr);
    if (!pick) {
      this.broadcast({ type: "error", code: "no-target", message: "오늘의 대결 주제어를 정하지 못했어요." });
      return;
    }
    const startAt = Date.now() + COUNTDOWN_MS;
    const roundPlayers = {};
    for (const s of this.activeSlots()) {
      roundPlayers[s] = freshRoundPlayer();
      if (!(s in this.state.roundWins)) this.state.roundWins[s] = 0;
    }
    this.state.roundState = {
      round, target: pick.target, par: pick.par, materials: pick.materials, path: pick.path,
      startAt, deadlineAt: null, winner: null, reason: null, finishAt: null,
      p: roundPlayers,
    };
    this.state.phase = "countdown";
    await this.save();
    this.broadcast({ type: "countdown", startAt, round, target: pick.target, par: pick.par, materials: pick.materials, mode: this.state.mode, totalRounds: this.state.totalRounds });
    await this.scheduleAlarm("round-start", startAt);
  }

  // ---------- 대전 중 ----------
  // 시도 정의 (2026-11-15 수정): 제출한 조합은 성공·실패를 가리지 않고
  // 모두 시도 수(tried)에 셈한다. 실패 시도도 progress로 tried를 알린다.
  async handleAttempt(slot, data) {
    const st = this.state;
    const rs = st.roundState;
    if (st.phase !== "playing" || !rs) {
      const msg = st.phase === "round-end" || st.phase === "finished"
        ? "스테이지 시간이 끝났어요. 다음 스테이지를 기다려주세요."
        : st.phase === "countdown" ? "아직 시작 전이에요. 곧 시작해요."
        : "상대를 기다리는 중이에요.";
      return this.sendTo(slot, { type: "error", code: "invalid-attempt", reason: "not-playing", message: msg });
    }
    const a = typeof data.a === "string" ? data.a.trim() : "";
    const b = typeof data.b === "string" ? data.b.trim() : "";
    if (!a || !b) {
      return this.sendTo(slot, { type: "error", code: "invalid-attempt", reason: "bad-input", message: "단어 2개를 골라주세요." });
    }
    const ps = rs.p[slot];
    if (!ps) {
      return this.sendTo(slot, { type: "error", code: "invalid-attempt", reason: "not-playing", message: "이 라운드에 참가하고 있지 않아요." });
    }
    if (st.players[slot].left) {
      return this.sendTo(slot, { type: "error", code: "invalid-attempt", reason: "not-playing", message: "판에서 나갔어요." });
    }
    if (ps.forfeited) {
      return this.sendTo(slot, { type: "error", code: "invalid-attempt", reason: "forfeited", message: "이 라운드는 포기했어요." });
    }
    const owned = new Set([...rs.materials, ...ps.found]);
    if (!owned.has(a) || !owned.has(b)) {
      ps.tried += 1;
      await this.save();
      this.broadcast({ type: "progress", player: slot, found: ps.found.length, tried: ps.tried, pathStep: this.pathStepOf(slot), round: rs.round });
      return this.sendTo(slot, { type: "error", code: "invalid-attempt", reason: "not-owned", message: "가지고 있지 않은 단어예요." });
    }
    const combo = findBattleCombo(a, b);
    if (!combo) {
      ps.tried += 1;
      await this.save();
      this.broadcast({ type: "progress", player: slot, found: ps.found.length, tried: ps.tried, pathStep: this.pathStepOf(slot), round: rs.round });
      return this.sendTo(slot, { type: "error", code: "invalid-attempt", reason: "no-combo", message: "합성되지 않는 조합이에요." });
    }
    ps.tried += 1;
    if (!ps.found.includes(combo.result)) ps.found.push(combo.result);
    const pathStep = this.pathStepOf(slot);
    await this.save();
    this.broadcast({ type: "progress", player: slot, found: ps.found.length, tried: ps.tried, pathStep, round: rs.round });
    // patch30: 발견한 단어는 시도한 본인에게만 직접 보낸다 (progress는 숫자만 공개 — T14).
    // 늦은 응답에도 클라이언트가 BT.found를 재동기화할 수 있게 foundList도 함께 보낸다.
    this.sendTo(slot, { type: "found-sync", player: slot, round: rs.round, result: combo.result, foundList: ps.found.slice(), found: ps.found.length, tried: ps.tried, pathStep });
    if (combo.result === rs.target) {
      ps.clearedAt = Date.now();
      ps.ms = ps.clearedAt - rs.startAt;
      ps.clearMs = ps.ms;
      const pl = st.players[slot];
      if (pl) pl.lastClearMs = ps.clearedAt; // v1.2: 최종 순위 동점 판정용 (서버 epoch ms)
      await this.save();
      if (st.mode === "points") {
        // v1.3 정정: 첫 클리어 시 마감 창은 방장 설정(finishWindowMs, 기본 60초).
        // 그 외 클리어는 finishAt null. 라운드 종료는 전원 클리어·마감·타임아웃 중 먼저 오는 것.
        let finishAt = null;
        if (!rs.finishAt) {
          rs.finishAt = ps.clearedAt + (st.finishWindowMs ?? FINISH_WINDOW_MS);
          finishAt = rs.finishAt;
          await this.save();
          await this.scheduleAlarm("finish-window", rs.finishAt, { round: rs.round });
        }
        this.broadcast({ type: "cleared", player: slot, attempts: ps.tried, ms: ps.ms, round: rs.round, finishAt });
        await this.checkPointsRoundEnd();
      } else {
        this.broadcast({ type: "cleared", player: slot, attempts: ps.tried, ms: ps.ms, round: rs.round });
        await this.endRound(slot, "cleared");
      }
    }
  }

  async handleForfeit(slot) {
    const st = this.state;
    if (st.phase === "playing") {
      if (st.mode === "points") {
        // v1.2: 그 라운드만 포기 (0점, 다음 라운드 계속 참가).
        const rs = st.roundState;
        const ps = rs && rs.p[slot];
        if (!ps) {
          return this.sendTo(slot, { type: "error", code: "not-playing", message: "이 라운드에 참가하고 있지 않아요." });
        }
        if (ps.clearedAt) {
          return this.sendTo(slot, { type: "error", code: "not-playing", message: "이미 클리어했어요." });
        }
        if (!ps.forfeited) {
          ps.forfeited = true;
          await this.save();
          this.broadcast(this.publicRoom(null));
          await this.checkPointsRoundEnd();
        }
        return;
      }
      await this.endRound(this.otherActiveSlot(slot), "forfeit");
    } else if (st.phase === "countdown") {
      if (st.mode === "points") {
        // v1.2: 카운트다운 중 포기 = 판 이탈.
        const p = st.players[slot];
        p.left = true;
        await this.save();
        this.broadcast({ type: "player-left", player: slot, nick: p.nick });
        this.broadcast(this.publicRoom(null));
        await this.afterPointsLeave("forfeit");
        return;
      }
      await this.cancelAlarm("round-start");
      await this.endMatch(this.otherActiveSlot(slot), "forfeit");
    } else if (st.phase === "waiting") {
      delete st.players[slot];
      await this.save();
      this.broadcast(this.publicRoom(null));
      if (this.playerCount() === 0) await this.scheduleAlarm("delete", Date.now() + DELETE_AFTER_FINISH_MS);
    } else {
      this.sendTo(slot, { type: "error", code: "not-playing", message: "지금은 포기할 수 없어요." });
    }
  }

  async handleRematch(slot) {
    if (this.state.phase !== "finished") {
      return this.sendTo(slot, { type: "error", code: "not-finished", message: "판이 끝나야 재대결할 수 있어요." });
    }
    this.state.players[slot].rematch = true;
    await this.save();
    this.broadcast(this.publicRoom(null));
    // v1.2: 이탈하지 않은 전원의 동의가 필요하고, 이탈자는 복귀하지 않는다.
    const active = this.activeSlots();
    if (active.length > 0 && active.every((s) => this.state.players[s].rematch)) {
      this.state.matchNo += 1;
      this.state.round = 0;
      this.state.roundWins = {};
      for (const s of Object.keys(this.state.players)) this.state.roundWins[s] = 0;
      this.state.rounds = [];
      this.state.roundState = null;
      this.state.matchWinner = null;
      this.state.pendingMatch = null;
      // v1.3 정정: 재대결은 같은 방 타입·설정을 유지한다
      // (mode/totalRounds/roundLimitMs/finishWindowMs 초기화 안 함).
      this.state.phase = "waiting";
      for (const p of Object.values(this.state.players)) {
        p.ready = false; p.rematch = false;
        p.points = 0; p.matchTried = 0; p.lastClearMs = null; // v1.2: 총점·시도·최종 클리어 초기화
      }
      await this.save();
      this.broadcast(this.publicRoom(null));
    }
  }

  // ---------- v1.2 포인트제 헬퍼 ----------
  // 활성 전원이 클리어·포기했으면 라운드 종료 (이탈은 활성에서 빠져서 검사를 통과한다).
  async checkPointsRoundEnd() {
    const st = this.state;
    if (st.phase !== "playing" || st.mode !== "points" || !st.roundState) return;
    const rs = st.roundState;
    const done = this.activeSlots().every((s) => {
      const ps = rs.p[s];
      return ps && (ps.clearedAt || ps.forfeited);
    });
    if (done) await this.endRound(null, "all-cleared");
  }

  // 포인트제 이탈 후 처리: 1명 남으면 즉시 승리, 0명이면 판 종료(또는 방 정리),
  // 2명 이상이면 판 계속 + 전원 클리어 여부 재평가.
  async afterPointsLeave(singleReason) {
    const st = this.state;
    if (st.phase === "finished") return;
    const active = this.activeSlots();
    if (active.length === 1 && (st.phase === "playing" || st.phase === "countdown" || st.phase === "round-end")) {
      await this.endMatchAfterSettling(active[0], singleReason);
    } else if (active.length === 0) {
      if (st.phase === "playing" || st.phase === "countdown" || st.phase === "round-end") {
        await this.endMatchAfterSettling(null, "both-left");
      } else {
        await this.scheduleAlarm("delete", Date.now() + DELETE_AFTER_FINISH_MS);
      }
    } else if (st.phase === "playing") {
      await this.checkPointsRoundEnd();
    }
  }

  // 이번 라운드 순위표 계산 + 점수·총점·시도 누적 + 1위 횟수 반영.
  computeRoundRanks() {
    const st = this.state;
    const rs = st.roundState;
    const entries = Object.keys(rs.p).map((slot) => {
      const ps = rs.p[slot];
      const pl = st.players[slot];
      return {
        slot, nick: pl ? pl.nick : slot, cleared: !!ps.clearedAt,
        clearMs: ps.clearedAt ? ps.ms : null,
        pathStep: this.pathStepOf(slot), tried: ps.tried, found: ps.found.length,
      };
    });
    const ranks = computeRanks(entries);
    for (const r of ranks) {
      const ps = rs.p[r.slot];
      ps.points = r.points;
      ps.rank = r.rank;
      ps.clearMs = r.clearMs;
      const pl = st.players[r.slot];
      if (pl) {
        pl.points = (pl.points || 0) + r.points;
        pl.matchTried = (pl.matchTried || 0) + ps.tried;
      }
      if (r.rank === 1 && r.clearMs !== null) {
        st.roundWins[r.slot] = (st.roundWins[r.slot] || 0) + 1;
      }
    }
    const first = ranks.find((r) => r.rank === 1 && r.clearMs !== null);
    return { ranks, winner: first ? first.slot : null };
  }

  // 최종 순위 (총점 → 1위 횟수 → 총 시도 → 마지막 클리어 시각).
  computeStandings() {
    const st = this.state;
    // patch33 (여울 QA 3): 판에 한 번도 참가하지 않고 떠난 고스트(이탈·0점·시도 0)는
    // 최종 순위에서 뺀다. 재대결 로비에 남은 이전 판의 이탈자 행이 "3위 모아 0점"처럼
    // 최종 순위에 남던 문제. (한 라운드라도 플레이한 이탈자는 점수가 있어 남는다.)
    return computeStandings(Object.values(st.players)
      .filter((p) => !(p.left && (p.points || 0) === 0 && (p.matchTried || 0) === 0))
      .map((p) => ({
      slot: p.id, nick: p.nick, points: p.points || 0,
      roundWins: st.roundWins[p.id] || 0, tried: p.matchTried || 0,
      lastClearMs: p.lastClearMs ?? null,
    })));
  }

  // ---------- 라운드·판 종료 ----------
  roundStats() {
    const rs = this.state.roundState;
    const now = Date.now();
    const out = {};
    for (const slot of Object.keys(rs.p)) {
      const ps = rs.p[slot];
      out[slot] = {
        tried: ps.tried,
        found: ps.found.length,
        ms: ps.clearedAt ? ps.ms : (now - rs.startAt),
      };
    }
    return out;
  }

  async endRound(winnerSlot, reason) {
    const st = this.state;
    if (st.phase !== "playing" || !st.roundState) return;
    const rs = st.roundState;
    await this.cancelAlarm("finish-window");
    await this.cancelAlarm("round-timeout");
    const stats = this.roundStats();
    const isPoints = st.mode === "points";
    let winner = winnerSlot;
    let ranks = null;
    if (isPoints) {
      // v1.2: 순위표 계산 + 점수 부여 (winner는 1위 슬롯, 동점이면 첫 슬롯).
      const computed = this.computeRoundRanks();
      ranks = computed.ranks;
      winner = computed.winner;
      st.rounds.push({ round: rs.round, target: rs.target, par: rs.par, winner, reason, stats, ranks });
    } else {
      st.rounds.push({ round: rs.round, target: rs.target, par: rs.par, winner: winnerSlot, reason, stats });
      if (winnerSlot) st.roundWins[winnerSlot] = (st.roundWins[winnerSlot] || 0) + 1;
    }
    rs.winner = winner;
    rs.reason = reason;
    st.phase = "round-end";
    await this.save();
    const msg = {
      type: "result", scope: "round", winner, reason, stats,
      roundWins: { ...st.roundWins }, round: rs.round, matchNo: st.matchNo,
    };
    if (isPoints) {
      msg.ranks = ranks;
      msg.points = {};
      for (const p of Object.values(st.players)) msg.points[p.id] = p.points || 0;
      msg.mode = "points";
    }
    this.broadcast(msg);
    if (isPoints) {
      if (rs.round >= (st.totalRounds || POINTS_TOTAL_ROUNDS)) {
        // v1.2: 5라운드 뒤 판 승자는 최종 순위 1위 (총점 → 1위 횟수 → 시도 → 최종 클리어).
        const standings = this.computeStandings();
        st.pendingMatch = { winner: standings.length ? standings[0].slot : null, reason: "match" };
        await this.save();
        await this.scheduleAlarm("match-result", Date.now() + MATCH_RESULT_DELAY_MS);
        return;
      }
      await this.scheduleAlarm("next-round", Date.now() + INTER_ROUND_MS);
      return;
    }
    if (winnerSlot && st.roundWins[winnerSlot] >= WINS_TO_WIN) {
      // 결승: 판 결과를 바로 보내지 않고 2초 뒤 알람으로 보낸다.
      // 라운드 결과 화면이 그 사이 보인다.
      st.pendingMatch = { winner: winnerSlot, reason: "match" };
      await this.save();
      await this.scheduleAlarm("match-result", Date.now() + MATCH_RESULT_DELAY_MS);
      return;
    }
    await this.scheduleAlarm("next-round", Date.now() + INTER_ROUND_MS);
  }

  // patch33 (여울 QA 1·2): 1명만 남아 판이 일찍 끝날 때, 진행 중 라운드를 먼저
  // 정산(클리어 순위·점수 반영)한 뒤 라운드 결과를 보여주고 2초 뒤 판 결과를 보낸다.
  // 기존에는 endMatch를 바로 불러서 진행 중 라운드 행·점수가 결과 화면에서 통째로 빠졌다
  // (XA66WQ 1판: 유리 라운드에 여울이 먼저 클리어했는데 행·점수 누락).
  // scheduleAlarm은 같은 kind를 교체하므로, endRound가 마지막 라운드로 이미 건
  // match-result 알람도 아래 호출이 최종 판정(남은 쪽 승리)으로 덮는다.
  async endMatchAfterSettling(winnerSlot, reason) {
    const st = this.state;
    if (st.phase === "playing") {
      await this.endRound(null, reason);
      await this.cancelAlarm("next-round");
      st.pendingMatch = { winner: winnerSlot, reason };
      await this.save();
      await this.scheduleAlarm("match-result", Date.now() + MATCH_RESULT_DELAY_MS);
      return;
    }
    await this.endMatch(winnerSlot, reason);
  }

  async endMatch(winnerSlot, reason) {
    const st = this.state;
    if (st.phase === "finished") return;
    await this.cancelAlarm("round-start");
    await this.cancelAlarm("round-timeout");
    await this.cancelAlarm("finish-window");
    await this.cancelAlarm("next-round");
    await this.cancelAlarm("match-result");
    st.pendingMatch = null;
    st.phase = "finished";
    st.matchWinner = winnerSlot;
    await this.save();
    const msg = {
      type: "result", scope: "match", winner: winnerSlot, reason,
      stats: { rounds: st.rounds, roundWins: { ...st.roundWins } },
      roundWins: { ...st.roundWins }, round: st.round, matchNo: st.matchNo,
    };
    if (st.mode === "points") {
      msg.standings = this.computeStandings();
      msg.mode = "points";
    }
    this.broadcast(msg);
    await this.scheduleAlarm("delete", Date.now() + DELETE_AFTER_FINISH_MS);
  }

  async handlePlayerLeft(slot) {
    const st = this.state;
    if (!st) return;
    const pl = st.players[slot];
    if (st.phase === "waiting" || st.phase === "finished") {
      this.broadcast(this.publicRoom(null));
      if (st.phase === "waiting" && Object.values(st.players).every((p) => !p.connected)) {
        await this.scheduleAlarm("delete", Date.now() + DELETE_AFTER_FINISH_MS);
      }
      return;
    }
    if (st.mode === "points") {
      // v1.2: 포인트제는 player-left 브로드캐스트, 판은 활성 2인 이상이면 계속.
      this.broadcast({ type: "player-left", player: slot, nick: pl ? pl.nick : "" });
      this.broadcast(this.publicRoom(null));
      await this.afterPointsLeave("opponent-left");
      return;
    }
    // 클래식(1v1): 기존 동작 유지 — opponent-left + 남은 쪽 판 승리.
    const other = Object.keys(st.players).find((s) => s !== slot);
    const otherPl = other ? st.players[other] : null;
    if (!otherPl || !otherPl.connected) {
      // 둘 다 나감: 진행 중이었으면 무승부로 판 종료, 아니면 방 정리.
      if (st.phase === "playing" || st.phase === "countdown" || st.phase === "round-end") {
        await this.endMatchAfterSettling(null, "both-left");
      } else if (st.phase === "waiting") {
        await this.scheduleAlarm("delete", Date.now() + DELETE_AFTER_FINISH_MS);
      }
      return;
    }
    if (st.phase === "playing" || st.phase === "countdown" || st.phase === "round-end") {
      this.sendTo(other, { type: "opponent-left", player: slot });
      await this.endMatchAfterSettling(other, "opponent-left");
    }
  }
}
