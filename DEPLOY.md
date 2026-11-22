# 단어 연금술 배포 폴더

라이브: https://wordalchemy.aldol.app/ (Cloudflare Pages 프로젝트 `word-alchemy`)

## 배포 절차 (2026-11-13 로딩 경량화 이후)

아티팩트(`daneo-yeongeumsul`)를 고친 뒤에는 반드시 이 순서를 지킨다.
내보낸 단일 HTML을 그대로 올리면 안 된다 — 이미지가 인라인 base64 PNG로
11MB가 넘기 때문이다.

1. 아티팩트 내보내기 (`artifact.export`)
   → `~/workspace/your_files/daneo-yeongeumsul/daneo-yeongeumsul.html`
2. 최적화 스크립트 실행 (이 폴더에서):
   `python3 optimize.py`
   - 내보낸 HTML의 data URI 이미지 118개(중복 포함, 고유 86종)를 추출해
     WebP q90으로 변환하고 `assets/img/<sha12>.webp` 로 쓴다.
   - HTML의 data URI를 전부 `/assets/img/<sha12>.webp` URL로 바꾼다.
   - 결과: index.html 약 400KB + WebP 총 약 1.0MB.
     첫 로딩은 HTML + 정적 에셋 2개(타이틀·모모) 약 467KB.
   - 아티팩트와 내보낸 파일은 건드리지 않는다. 이 폴더만 쓴다.
3. 배포:
   `python3 ~/workspace/custom-connectors/custom.cloudflare/bin/cf_wrangler.py pages deploy ~/workspace/deploy/word-alchemy --project-name word-alchemy`
4. 라이브 확인: `curl https://wordalchemy.aldol.app/` → 200 + 크기 확인,
   `data:image` 0건, WebP 몇 개 200 확인, Steel 스모크 체크.

## 파일 구성

- `index.html` — 최적화된 배포본 (optimize.py 산출물, 직접 고치지 말 것)
- `assets/img/*.webp` — 86종 게임 이미지 (내용 해시 파일명, manifest.json 참조)
- `assets/img/manifest.json` — 해시 → 크기·원본·등장 횟수
- `optimize.py` — 최적화 스크립트 (위 2번)
- `og-image.jpg` — 링크 미리보기 이미지 (1200×630, 아티팩트 내보내기에 없음)
- `favicon.ico`, `favicon.png`, `apple-touch-icon.png` — 사이트 아이콘

## 주의

- `og-image.jpg`와 파비콘 3종은 내보내기에 포함되지 않으니 재배포할 때마다
  이 폴더에 그대로 두어야 한다 (지우지 말 것).
- `assets/img/` 안의 오래된 `.webp`는 optimize.py가 자동 정리한다.
- WebP 품질은 q90 (배경·모모·정령 모두 육안 비교 완료, PNG와 차이 없음).
- Cloudflare가 Python-urllib 기본 UA를 403으로 막는다. WebP 200 확인은
  curl이나 브라우저 UA로 할 것 (실제 브라우저는 정상 로딩됨).
