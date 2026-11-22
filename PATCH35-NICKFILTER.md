# Patch 35 — 대전 닉네임 필터 (2026-11-20)

## 변경
- 파일: `index.html` (배포본 직접 패치, optimize.py 산출물)
- 롤백: `index.html.patch35-nickfilter.bak` (패치 전 원본, 라이브 SHA 3571f3de…)
- 배포 후 라이브 SHA: `dcb13cc0a1f30c47d00c393eeeb78f96ca9a21fe60efd2a3046a9ae61fab27d7`
- 배포: Cloudflare Pages `word-alchemy`, `pages deploy … --project-name word-alchemy`

## 동작
- 내 닉네임: 방 만들기/입장 때 검사. 금지어 포함 시 토스트
  "사용할 수 없는 단어가 들어 있어요. 다른 닉네임을 입력해주세요."를 띄우고
  서버로 보내지 않고 localStorage에도 저장하지 않는다.
- 저장된 닉네임이 금지어면 로드 시 기본값(연금술사NNNN)으로 초기화한다.
- 상대 닉네임: 서버에서 받은 값도 화면 표시 전에 검사하고, 금지어면 "상대"로 가린다.
  (수신 지점 + 순위표·결과 화면 렌더링 지점 모두)
- 검사 정규화: 공백·구두점 제거, 반복 문자 축소, 영문 leet(1→i, 0→o 등) 변환.
  `씨 바 ㄹ`, `씨바알`, `FUCKER`도 걸린다. 정상 닉네임 `소년연금술사`는 안 걸린다
  (bare "년"은 목록에서 제외 — 소년·청년 등 정상 단어 오탐 방지).
- 금지어 목록: 한국어 욕설·성적·혐오어 + 영어 욕설 약 40개 (`BATTLE_NICK_BANNED`).
  목록은 `index.html` 안 `btNickHasBanned` 바로 위에 있다.

## 검증
- Node 단위 테스트 23/23 PASS (`/tmp/nickfilter.js`, 금지어 15건·정상어 8건)
- 스크립트 문법 검사: 9개 `<script>` 블록 전부 `node --check` PASS
- Steel 라이브 QA 15/15 PASS, 콘솔·페이지 에러·실패 요청 0건
  (`~/workspace/steel-qa/out-wordalchemy-nickfilter/report.json`,
  스크립트 `qa-wordalchemy-nickfilter.mjs`)
  - 금지어 방 만들기: 토스트 표시, 방 생성 안 됨, 저장 안 됨
  - 띄어쓰기 우회도 차단
  - 정상 닉네임 `모모`: 방 생성(6자 코드)·대기 화면·저장 전부 정상, 방 나간 뒤 홈 복귀

## patch35b — 상대 닉네임 표시 구멍 2곳 추가 수정 (2026-11-20 20:22)
- 첫 배포 뒤 코드 재검사에서 발견: 내 닉네임 검사는 막았는데, 서버에서 받은
  상대 닉네임을 그대로 그리는 곳이 2곳 남아 있었다.
  ① 이탈 토스트(`btOnPlayerLeft`의 `d.nick`), ② 대기실 플레이어 목록
  (`btRenderWaiting`의 `p.nick`, 서버 room 데이터 원문).
- 수정: 두 곳 모두 `btDisplayNick`으로 가리고, `btWinsText`·라운드 결과·
  레이스 헤더·진행 토스트의 `BT.opp.nick` 표시도 같은 함수로 감쌌다.
  이후 원문 닉네임 표시 지점은 grep으로 0건 확인.
- 재배포 라이브 SHA: `437880c6a0ed061c1949b2de7b008792a3919c4f8ca0016b01266822dd79bc7e`
- 재검증: Steel 라이브 QA 15/15 PASS 재확인 (콘솔·페이지 에러·실패 요청 0건,
  `out-wordalchemy-nickfilter-35b/report.json`).

## patch35-server — 서버 쪽 닉네임 검사 추가 (2026-11-21 13:2x, 알돌 "서버추가하자")
- 배경: patch35는 클라이언트 측만이라, 웹소켓으로 직접 join을 보내면
  금지 닉네임이 방에 그대로 들어갔다. 서버(BattleRoom DO)가 join에서 거부한다.
- 변경 (서버): `~/workspace/word-alchemy-homonym-v1/battle-prototype/worker/src/room.js`
  - `BATTLE_NICK_BANNED`·`normalizeNickForFilter`·`nickHasBanned` 추가 — 클라이언트
    patch35와 동일 목록(약 40개)·동일 정규화. **목록을 바꿀 때는 클라이언트와
    서버 두 곳을 함께 바꿀 것.**
  - `handleJoin`에서 버전 검사 직후, 상태 변경 전에 검사: 금지어면
    `{type:"error", code:"bad-nick", message:"사용할 수 없는 단어가 들어 있어요. 다른 닉네임을 입력해주세요."}`를
    보내고 1008로 소켓 종료. 신규 입장·재접속(기존 playerId로 금지 닉네임으로
    돌아오는 경우) 둘 다 같은 경로라 같이 막힌다. 빈 닉네임은 기존대로 기본값 부여.
  - 롤백: `src/room.js.patch35-server.bak`, 테스트도 `test-room.mjs.patch35-server.bak`.
- 변경 (클라이언트): `index.html` `btOnError`의 로비 복귀 목록에 `"bad-nick"` 한 줄 추가
  (서버 거부 시 토스트 + 로비 복귀, 재연결 루프 없음 — `intentionalClose` 경유).
  롤백: `index.html.patch35-server.bak` (patch35b 적용본).
- 검증:
  - 서버 단위: `nickHasBanned` 7/7 PASS (씨발·띄어쓰기·반복·fuck 걸림, 모모·소년연금술사 안 걸림)
  - `test-room.mjs` 신규 T31(순수 함수 6건)·T32(실서버 join 거부 8건) 추가:
    로컬 wrangler dev **144 PASS / 0 FAIL**, 실서버 **143 PASS / 0 FAIL**
    (총합 1건 차이는 날짜별 경로 길이 변동 — 기존에도 105~106으로 오가던 범위)
  - 워커 배포: `wordalchemy-battle-test` 버전 `16d9dd1e-662a-41b5-ba4d-a16144d56085`
  - 클라이언트 재배포 라이브 SHA: `df39beea1a2426a4a58e5cdec123118ed25f3238c4539cd9abc6d320bbd263da`
    (curl 대조 일치, live HTML에 `bad-nick` 포함·튜터 마커 0건 확인)
  - Steel 라이브 QA 15/15 PASS 재확인 (콘솔·페이지 에러·실패 요청 0건,
    `out-wordalchemy-nickfilter-35server2/report.json` — 정정된 라이브 빌드 대상)
- **[사고·복원] 첫 클라이언트 배포 때 미승인 AI 튜터 코드가 라이브에 함께 나감 (2026-11-21 13:2x, 당일 복원):**
  작업 시작 시점의 `index.html`에는 오전에 만든 AI 튜터 패치(라이브 미배포·알돌 승인 대기)가
  이미 들어 있었고, bad-nick 한 줄만 추가한 뒤 그대로 배포해 버렸다.
  첫 배포 SHA `dac6326e…`의 라이브 HTML에 튜터 마커 5건이 있는 걸 배포 뒤 SHA 대조 때 발견.
  즉시 롤백: 튜터+bad-nick 상태는 `index.html.tutor+badnick.bak`으로 보존하고,
  `index.html.tutor.bak`(patch35b 원본)에 bad-nick만 다시 적용해 재배포 — 최종 라이브 SHA
  `df39beea…`, 튜터 마커 0건·bad-nick 포함 확인. Steel QA도 정정된 빌드로 다시 15/15.
  교훈: 배포 전에는 라이브 SHA뿐 아니라 **작업 외 변경(튜터 등 미승인 패치)이 파일에
  섞여 있지 않은지** 마커 grep으로 확인할 것. 튜터는 여전히 프리뷰 프로젝트에만 있음.
- 남은 한계: 자소 분리 등 정규화 밖 우회, 목록에 없는 신조어는 여전히 못 잡는다.
  IARC 초안 2-3절 "필터 있음" 유지, 서버 검증 완료로 정정.

## 주의 — 다음 optimize.py 재내보내기 때
- `index.html`은 optimize.py 산출물이라 다음에 아티팩트를 다시 내보내면
  이 필터가 **사라진다**. 재내보내기 후에는 이 패치를 다시 적용할 것
  (롤백 파일과의 diff, 또는 이 문서의 동작 설명을 기준으로 재적용).
- 완전한 차단이 아니다: 서버 쪽 검증이 없어 자소 분리 등 우회는 가능하고,
  목록에 없는 신조어는 못 잡는다. 서버(배틀 테스트 워커) 쪽 검증은 별도 작업이다.
- IARC 초안(`~/workspace/your_files/wordalchemy-iarc-draft.md`) 2-3절은
  "필터 있음"으로 업데이트됨.
