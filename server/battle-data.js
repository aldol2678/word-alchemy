// GENERATED — 손으로 고치지 말 것. extract-battle-data.py가 생성함.
// 원본: 단어연금술 index.html v5.5 (SHA-256 060c3c8a0f9eef402ca4748533e9b9518235abd51360385f3c3170c122c098a7)
// INF_COMBOS + COMBOS + 날짜 엔진(dailyMaterials/hashDateStr/BFS)은 원문 그대로.
// COMBOS 71개는 스토리 모드 조합 - 대전 허용 집합은 INF_COMBOS 와 COMBOS의 합집합 (버그 5).
// 파 계산(dailyComboReach)·경로(dailyComboPath)는 BATTLE_ALL_COMBOS 기준 (patch30 추가 3·4:
// INF + INF와 쌍이 안 겹치는 COMBOS — 실제 합성 가능한 최단 경로, 같은 쌍은 INF 결과만 유효).
// v1.1 대전 목표 뽑기(battleTargetPool/battlePickTarget)는 이 파일 하단에 직접 작성.

export const GAME_VERSION = "v5.5";
export const SOURCE_SHA = "060c3c8a0f9eef402ca4748533e9b9518235abd51360385f3c3170c122c098a7";
export const INF_HASH = "cfd0b6f33c77a8145dbbae2afcbca2f65897012415f7eca1e4ca1fc97afd14f6"; // 정식 조합 목록 SHA-256
export const INF_HASH_SHORT = "cfd0b6f3";

const INF_BASES = ["물", "불", "바람", "흙"];

const INF_COMBOS = [
  { a: "물", b: "물", result: "호수", msg: "물과 물이 깊이 고여 잔잔한 호수가 됐어요!" },
  { a: "물", b: "바람", result: "파도", msg: "바람이 물결을 밀어 파도가 일렁여요!" },
  { a: "불", b: "불", result: "화염", msg: "불과 불이 겹쳐 거센 화염이 치솟아요!" },
  { a: "불", b: "바람", result: "불꽃", msg: "바람을 탄 불이 불꽃으로 튀어올라요!" },
  { a: "불", b: "흙", result: "용암", msg: "흙이 불에 녹아 용암이 흘러내려요!" },
  { a: "바람", b: "바람", result: "회오리", msg: "바람이 바람을 휘감아 회오리가 됐어요!" },
  { a: "바람", b: "흙", result: "먼지", msg: "바람이 흙을 말려 먼지가 풀풀 날려요." },
  { a: "흙", b: "흙", result: "돌", msg: "흙이 단단히 뭉쳐 돌이 됐어요!" },
  { a: "물", b: "용암", result: "증기", msg: "뜨거운 용암에 물이 닿자 증기가 피어올라요!" },
  { a: "먼지", b: "물", result: "진흙", msg: "먼지가 물을 머금어 진흙처럼 뭉쳐요." },
  { a: "호수", b: "물", result: "강", msg: "호수의 물이 길을 찾아 강으로 흘러요!" },
  { a: "호수", b: "바람", result: "물결", msg: "호수 위에 잔잔한 물결이 번져요." },
  { a: "호수", b: "불", result: "안개", msg: "호수의 물기가 김으로 올라 안개가 됐어요." },
  { a: "호수", b: "흙", result: "늪", msg: "호숫가가 흙에 잠겨 늪이 됐어요." },
  { a: "파도", b: "물", result: "해일", msg: "파도가 겹치고 겹쳐 거대한 해일이 됐어요!" },
  { a: "파도", b: "바람", result: "태풍", msg: "파도와 바람이 몰아쳐 태풍이 됐어요!" },
  { a: "파도", b: "흙", result: "해변", msg: "파도가 흙을 다듬어 해변이 펼쳐졌어요." },
  { a: "파도", b: "불", result: "소금", msg: "파도가 뜨거운 불에 말라 소금이 남았어요." },
  { a: "화염", b: "물", result: "연기", msg: "화염이 물에 식으며 연기가 피어올라요." },
  { a: "화염", b: "바람", result: "열풍", msg: "화염을 실은 바람이 열풍이 됐어요!" },
  { a: "화염", b: "흙", result: "재", msg: "화염이 흙 위에서 사그라져 재가 남았어요." },
  { a: "불꽃", b: "바람", result: "불꽃놀이", msg: "불꽃이 바람에 실려 하늘에 불꽃놀이가 펼쳐져요!" },
  { a: "용암", b: "호수", result: "온천", msg: "용암이 호수를 데워 김이 나는 온천이 됐어요!" },
  { a: "용암", b: "흙", result: "화산", msg: "용암이 흙을 밀어 올려 화산이 솟았어요!" },
  { a: "회오리", b: "물", result: "소용돌이", msg: "회오리가 물을 휘감아 소용돌이가 됐어요!" },
  { a: "회오리", b: "바람", result: "폭풍", msg: "회오리에 바람이 더해져 폭풍이 몰아쳐요!" },
  { a: "회오리", b: "흙", result: "황사", msg: "회오리가 흙먼지를 실어 황사가 됐어요." },
  { a: "회오리", b: "불", result: "불기둥", msg: "회오리가 불을 휘감아 불기둥이 솟아요!" },
  { a: "먼지", b: "바람", result: "사막", msg: "먼지가 바람에 쌓이고 쌓여 사막이 됐어요." },
  { a: "먼지", b: "불", result: "화약", msg: "먼지에 불이 닿자 팡! 화약이 됐어요. 조심!" },
  { a: "먼지", b: "흙", result: "모래", msg: "먼지와 흙이 고와져 모래가 됐어요." },
  { a: "모래", b: "화염", result: "유리", msg: "모래가 화염에 녹아 투명한 유리가 됐어요!" },
  { a: "돌", b: "물", result: "자갈", msg: "돌이 물에 굴러 동글동글 자갈이 됐어요." },
  { a: "돌", b: "불", result: "철", msg: "돌 속 광물을 불로 녹여 철을 얻었어요!" },
  { a: "돌", b: "바람", result: "절벽", msg: "바람이 돌산을 깎아 절벽이 드러났어요." },
  { a: "돌", b: "흙", result: "언덕", msg: "돌과 흙이 쌓여 나지막한 언덕이 됐어요." },
  { a: "안개", b: "물", result: "비", msg: "안개의 물방울이 뭉쳐 비가 내리기 시작해요." },
  { a: "강", b: "흙", result: "협곡", msg: "강이 흙을 파고들어 깊은 협곡이 됐어요." },
  { a: "강", b: "바람", result: "폭포", msg: "강물이 바람에 밀려 아래로 떨어져 폭포가 됐어요!" },
  { a: "강", b: "돌", result: "계곡", msg: "강이 돌 사이를 흘러 계곡이 됐어요." },
  { a: "늪", b: "물", result: "연못", msg: "늪의 물이 맑게 고여 연못이 됐어요." },
  { a: "늪", b: "불", result: "도깨비불", msg: "늪에서 푸른 도깨비불이 떠올랐어요!" },
  { a: "비", b: "흙", result: "새싹", msg: "비를 맞은 흙에서 새싹이 쏙 돋았어요!" },
  { a: "새싹", b: "물", result: "나무", msg: "새싹이 물을 마시고 나무로 자랐어요!" },
  { a: "새싹", b: "바람", result: "잎", msg: "새싹이 바람에 잎을 펼쳤어요." },
  { a: "새싹", b: "새싹", result: "대나무", msg: "새싹이 쑥쑥 자라 대나무가 됐어요!" },
  { a: "나무", b: "새싹", result: "숲", msg: "나무와 새싹이 어우러져 숲이 됐어요." },
  { a: "해변", b: "물", result: "섬", msg: "해변 너머 물 위에 섬이 떠올랐어요." },
  { a: "해변", b: "돌", result: "조개", msg: "해변의 돌 틈에서 조개를 찾았어요!" },
  { a: "해일", b: "흙", result: "홍수", msg: "해일이 흙을 삼켜 홍수가 났어요!" },
  { a: "연기", b: "연기", result: "미세먼지", msg: "연기가 자욱히 겹쳐 미세먼지가 됐어요." },
  { a: "재", b: "흙", result: "비료", msg: "재를 흙에 섞어 비료를 만들었어요." },
  { a: "화산", b: "연기", result: "분화", msg: "화산이 연기를 뿜으며 분화했어요!" },
  { a: "폭풍", b: "불", result: "번개", msg: "폭풍 속에서 불같은 번개가 번쩍!" },
  { a: "자갈", b: "재", result: "콘크리트", msg: "자갈과 재를 섞어 단단한 콘크리트가 됐어요!" },
  { a: "철", b: "물", result: "녹", msg: "철이 물에 젖어 붉은 녹이 슬었어요." },
  { a: "철", b: "흙", result: "광석", msg: "흙 속에서 철의 원석, 광석을 캐냈어요!" },
  { a: "절벽", b: "돌", result: "동굴", msg: "절벽의 돌이 무너져 동굴 입구가 열렸어요." },
  { a: "언덕", b: "바람", result: "초원", msg: "언덕에 바람이 불어 초원이 펼쳐졌어요." },
  { a: "나무", b: "돌", result: "장작", msg: "나무를 돌로 쪼개 장작을 만들었어요." },
  { a: "잎", b: "물", result: "차", msg: "잎을 물에 우려 향긋한 차가 됐어요." },
  { a: "잎", b: "바람", result: "부채", msg: "잎을 엮어 시원한 부채를 만들었어요." },
  { a: "잎", b: "잎", result: "화관", msg: "잎을 둥글게 엮어 화관을 만들었어요." },
  { a: "비료", b: "새싹", result: "꽃", msg: "비료를 먹고 새싹이 꽃을 피웠어요!" },
  { a: "비료", b: "흙", result: "밭", msg: "비료 섞인 흙으로 밭을 일궜어요." },
  { a: "밭", b: "물", result: "논", msg: "밭에 물을 대어 논이 됐어요." },
  { a: "밭", b: "새싹", result: "채소", msg: "밭의 새싹이 자라 채소가 됐어요." },
  { a: "논", b: "물", result: "벼", msg: "논에 물이 차오르고 벼가 자랐어요." },
  { a: "벼", b: "돌", result: "쌀", msg: "벼를 돌에 찧어 쌀이 됐어요." },
  { a: "쌀", b: "물", result: "밥", msg: "쌀에 물을 붓고 지어 밥이 됐어요!" },
  { a: "채소", b: "밥", result: "비빔밥", msg: "채소를 밥에 올려 비빔밥이 됐어요!" },
  { a: "채소", b: "물", result: "수프", msg: "채소를 물에 끓여 수프가 됐어요." },
  { a: "채소", b: "채소", result: "샐러드", msg: "채소를 모아 상큼한 샐러드 완성!" },
  { a: "차", b: "차", result: "홍차", msg: "차를 진하게 우려 홍차가 됐어요." },
  { a: "장작", b: "불", result: "모닥불", msg: "장작에 불을 붙여 모닥불이 타올라요." },
  { a: "동굴", b: "바람", result: "종유석", msg: "동굴에 바람과 세월이 쌓여 종유석이 자랐어요." },
  { a: "동굴", b: "돌", result: "수정", msg: "동굴 깊은 곳에서 반짝이는 수정을 찾았어요!" },
  { a: "수정", b: "물", result: "보석", msg: "수정을 물에 씻자 보석처럼 빛나요!" },
  { a: "광석", b: "불", result: "은", msg: "광석을 녹여 은이 흘러나왔어요!" },
  { a: "광석", b: "돌", result: "금", msg: "광석을 돌로 캐내자 금이 반짝!" },
  { a: "녹", b: "불", result: "철", msg: "녹을 불에 달궈 다시 철로 되돌렸어요." },
  { a: "콘크리트", b: "물", result: "댐", msg: "콘크리트로 물을 막아 댐이 됐어요!" },
  { a: "콘크리트", b: "돌", result: "건물", msg: "콘크리트와 돌로 건물을 세웠어요!" },
  { a: "콘크리트", b: "유리", result: "빌딩", msg: "유리창 반짝이는 빌딩이 솟았어요!" },
  { a: "건물", b: "건물", result: "도시", msg: "건물이 모이고 모여 도시가 됐어요!" },
  { a: "도시", b: "강", result: "항구", msg: "강가의 도시에 항구가 열렸어요." },
  { a: "댐", b: "물", result: "전기", msg: "댐의 물이 전기를 만들어요! 수력 발전!" },
  { a: "댐", b: "바람", result: "발전소", msg: "댐과 바람의 힘으로 발전소가 돌아가요." },
  { a: "전기", b: "철", result: "자석", msg: "철에 전기가 흐르자 자석이 됐어요!" },
  { a: "전기", b: "유리", result: "전구", msg: "유리 안에 전기를 가둬 전구가 켜졌어요!" },
  { a: "전기", b: "불", result: "플라즈마", msg: "전기와 불이 만나 플라즈마가 번쩍여요!" },
  { a: "자석", b: "철", result: "나침반", msg: "자석과 철로 방향을 찾는 나침반 완성!" },
  { a: "화약", b: "불", result: "폭탄", msg: "화약에 불이 닿아 폭탄이 됐어요. 조심조심!" },
  { a: "폭탄", b: "불", result: "폭발", msg: "콰광! 커다란 폭발이 일어났어요!" },
  { a: "섬", b: "돌", result: "등대", msg: "섬에 돌탑을 쌓아 등대를 세웠어요." },
  { a: "조개", b: "모래", result: "진주", msg: "조개 속 모래알이 진주로 변했어요!" },
  { a: "진주", b: "은", result: "목걸이", msg: "진주를 은줄에 꿰어 목걸이가 됐어요." },
  { a: "항구", b: "바람", result: "배", msg: "항구에 바람을 기다리던 배가 출항해요." },
  { a: "배", b: "증기", result: "증기선", msg: "증기 기관을 단 배, 증기선이 됐어요!" },
  { a: "빌딩", b: "불", result: "화재", msg: "빌딩에 불이 붙어 화재가 났어요! 조심!" },
  { a: "발전소", b: "철", result: "공장", msg: "발전소의 힘과 철로 공장이 돌아가요." },
  { a: "밥", b: "밥", result: "죽", msg: "밥을 푹 끓여 부드러운 죽이 됐어요." },
  { a: "수프", b: "불", result: "찌개", msg: "수프를 불에 끓여 찌개가 됐어요." },
  { a: "꽃", b: "꽃", result: "꽃다발", msg: "꽃을 모아 꽃다발을 만들었어요." },
  { a: "꽃", b: "바람", result: "향기", msg: "꽃의 향기가 바람에 실려 퍼져요." },
  { a: "꽃", b: "잎", result: "나비", msg: "꽃잎 사이로 나비가 날아왔어요!" },
  { a: "꽃", b: "흙", result: "화분", msg: "흙을 담은 그릇에 꽃을 심어 화분이 됐어요." },
  { a: "진흙", b: "돌", result: "골렘", msg: "진흙과 돌이 뭉쳐 골렘이 눈을 떴어요!" },
  { a: "진흙", b: "모래", result: "점토", msg: "진흙과 모래를 반죽해 점토가 됐어요." },
  { a: "점토", b: "불", result: "기와", msg: "점토를 구워 단단한 기와가 됐어요!" },
  { a: "유리", b: "증기", result: "플라스크", msg: "유리를 불어 증기를 담는 플라스크를 만들었어요." },
  { a: "플라스크", b: "금", result: "연금술", msg: "금을 녹인 플라스크에서 연금술이 시작돼요!" },
  { a: "연금술", b: "불", result: "현자의돌", msg: "연금술의 불꽃 끝에서 현자의 돌이 태어났어요!" },
  { a: "현자의돌", b: "철", result: "금", msg: "현자의 돌이 철을 금으로 바꿨어요! 전설의 연금술!" },
  { a: "현자의돌", b: "물", result: "생명수", msg: "현자의 돌이 물에 닿아 생명수가 됐어요." },
  { a: "불", b: "재", result: "불씨", msg: "재 속에서 작은 불씨가 살아남았어요." },
  { a: "물", b: "소금", result: "소금물", msg: "물에 소금을 녹여 소금물이 됐어요." },
  { a: "모래", b: "바람", result: "모래폭풍", msg: "모래가 바람에 휘몰아 모래폭풍이 됐어요!" },
  { a: "나무", b: "연기", result: "숯", msg: "나무가 연기를 내며 천천히 타 숯이 됐어요." },
  { a: "철", b: "나무", result: "도끼", msg: "철날에 나무 자루를 달아 도끼가 됐어요!" },
  { a: "도끼", b: "돌", result: "곡괭이", msg: "도끼와 돌로 땅을 팔 곡괭이를 만들었어요." },
  { a: "철", b: "돌", result: "망치", msg: "철과 돌을 맞대어 망치가 됐어요." },
  { a: "유리", b: "바람", result: "풍경", msg: "유리 종이 바람에 흔들려 풍경 소리가 나요." },
  { a: "전구", b: "전기", result: "빛", msg: "전구에 전기가 흐르자 빛이 켜졌어요!" },
  { a: "유리", b: "빛", result: "카메라", msg: "유리 렌즈로 빛을 담는 카메라 완성!" },
  { a: "카메라", b: "빛", result: "사진", msg: "카메라가 빛을 붙잡아 사진이 됐어요!" },
  { a: "금", b: "유리", result: "시계", msg: "금테 유리의 시계가 째깍째깍!" },
  { a: "시계", b: "모래", result: "모래시계", msg: "시계 속에 모래를 담아 모래시계가 됐어요." },
  { a: "유리", b: "유리", result: "안경", msg: "유리 두 장을 이어 안경이 됐어요." },
  { a: "금", b: "불", result: "종", msg: "금을 불에 녹여 종을 주조했어요. 댕—!" },
  { a: "종", b: "바람", result: "종소리", msg: "종이 바람에 흔들려 종소리가 울려요." },
  { a: "대나무", b: "바람", result: "피리", msg: "대나무에 구멍을 뚫어 피리를 만들었어요." },
  { a: "피리", b: "바람", result: "노래", msg: "피리에 바람이 실려 노래가 흘러요." },
  { a: "비", b: "나무", result: "버섯", msg: "비를 맞은 나무 아래 버섯이 돋았어요." },
  { a: "비", b: "잎", result: "우산", msg: "넓은 잎을 모아 비를 막는 우산을 만들었어요." },
  { a: "빛", b: "숲", result: "반딧불이", msg: "숲의 빛 사이로 반딧불이가 반짝여요." },
  { a: "빛", b: "비", result: "무지개", msg: "비 갠 하늘, 빛이 물방울에 닿아 무지개가 떴어요!" },
  { a: "빛", b: "회오리", result: "오로라", msg: "빛이 하늘에서 휘어져 오로라가 됐어요!" },
  { a: "번개", b: "바람", result: "천둥", msg: "번개 뒤를 따라 천둥이 울려요!" },
  { a: "열풍", b: "사막", result: "가뭄", msg: "열풍이 사막을 말려 가뭄이 왔어요." },
  { a: "사막", b: "물", result: "오아시스", msg: "사막 한가운데 물이 솟아 오아시스가 됐어요!" },
  { a: "사막", b: "돌", result: "피라미드", msg: "사막에 돌을 쌓아 피라미드가 솟았어요!" },
  { a: "화분", b: "새싹", result: "정원", msg: "화분과 새싹이 모여 정원이 됐어요." },
  { a: "정원", b: "도시", result: "공원", msg: "도시 속 정원이 모두의 공원이 됐어요." },
  { a: "공장", b: "전기", result: "로봇", msg: "공장의 전기가 로봇을 깨웠어요!" },
  { a: "로봇", b: "전기", result: "인공지능", msg: "로봇에 전기가 가득 차 인공지능이 눈떴어요!" },
  { a: "전기", b: "자석", result: "컴퓨터", msg: "전기와 자석의 힘으로 컴퓨터가 켜졌어요!" },
  { a: "컴퓨터", b: "전기", result: "인터넷", msg: "컴퓨터들이 전기로 이어져 인터넷이 됐어요!" },
  { a: "연못", b: "벼", result: "개구리", msg: "연못의 벼 사이로 개구리가 폴짝!" },
  { a: "어둠", b: "어둠", result: "심연", msg: "어둠이 어둠을 삼켜 끝없는 심연이 열렸어요!" },
  { a: "어둠", b: "불", result: "그림자", msg: "어둠에 불빛이 닿자 그림자가 길게 늘어졌어요!" },
  { a: "어둠", b: "물", result: "심해", msg: "어둠이 물을 삼켜 깊은 심해가 됐어요!" },
  { a: "어둠", b: "나무", result: "고목", msg: "어둠 속에서 나무가 오래오래 자라 고목이 됐어요!" },
  { a: "고목", b: "불", result: "숯", msg: "고목이 오래 타서 단단한 숯이 됐어요." },
  { a: "바람", b: "나무", result: "씨앗", msg: "바람에 나무 씨앗이 흩날려요!" },
  { a: "물", b: "나무", result: "이끼", msg: "물가에 나무가 젖어 이끼가 돋았어요." },
  { a: "번개", b: "구름", result: "천둥", msg: "번개가 구름을 울려 천둥이 쾅!" },
  { a: "전기", b: "구름", result: "번개", msg: "구름에 전기가 모여 번개가 번쩍!" },
  { a: "사막", b: "바람", result: "모래폭풍", msg: "사막에 바람이 불어 모래폭풍이 몰아쳐요!" }
];

const COMBOS = [
  /* ── 1단 · 기본 합성 (20) ── */
  { a: "비", b: "태양", result: "무지개", chain: 1, msg: "비 온 뒤 햇살! 무지개가 떴어요!" },
  { a: "물", b: "불", result: "증기", chain: 1, msg: "물과 불이 만나 증기가 피어올랐어요!" },
  { a: "물", b: "흙", result: "진흙", chain: 1, msg: "물과 흙이 섞여 진흙이 됐어요! 도자기 재료예요." },
  { a: "모래", b: "불", result: "유리", chain: 1, msg: "모래가 불에 녹아 유리로 변했어요!" },
  { a: "얼음", b: "태양", result: "물", chain: 1, msg: "얼음이 햇살에 녹아 물이 됐어요." },
  { a: "눈", b: "돌", result: "눈사람", chain: 1, msg: "눈뭉치에 돌 눈을 붙여 눈사람 완성!" },
  { a: "나무", b: "불", result: "연기", chain: 1, msg: "나무가 타며 연기가 피어올라요. 남은 건 숯길지도…" },
  { a: "철", b: "불", result: "검", chain: 1, msg: "달군 철을 두드려 검이 됐어요! 대장장이 연금술!" },
  { a: "종이", b: "연필", result: "책", chain: 1, msg: "종이에 글을 써서 책이 됐어요!" },
  { a: "빵", b: "치즈", result: "샌드위치", chain: 1, msg: "빵 사이에 치즈를 끼워 샌드위치 완성!" },
  { a: "얼음", b: "우유", result: "아이스크림", chain: 1, msg: "차가운 우유가 얼어 아이스크림이 됐어요!" },
  { a: "구름", b: "물", result: "비", chain: 1, msg: "구름이 물을 머금어 비가 내리기 시작해요." },
  { a: "바람", b: "구름", result: "태풍", chain: 1, msg: "바람이 구름을 휘몰아 태풍이 됐어요!" },
  { a: "씨앗", b: "물", result: "꽃", chain: 1, msg: "씨앗이 물을 마시고 꽃을 피웠어요!" },
  { a: "꽃", b: "벌", result: "꿀", chain: 1, msg: "벌이 꽃에서 꿀을 모아왔어요!" },
  { a: "나무", b: "나무", result: "숲", chain: 1, msg: "나무가 모이고 모여 숲이 됐어요!" },
  { a: "돌", b: "돌", result: "산", chain: 1, msg: "돌이 쌓이고 쌓여 산이 됐어요!" },
  { a: "강", b: "물", result: "바다", chain: 1, msg: "강물이 흘러 흘러 바다가 됐어요!" },
  { a: "금", b: "은", result: "보석", chain: 1, msg: "금과 은이 빛을 모아 보석으로 빛나요!" },
  { a: "눈", b: "바람", result: "눈보라", chain: 1, msg: "눈에 바람까지! 눈보라가 몰아쳐요!" },
  /* ── 2단 · 연쇄 합성 (20) — 1단 결과가 재료가 된다 ── */
  { a: "증기", b: "바람", result: "구름", chain: 2, msg: "증기가 바람을 타고 올라가 구름이 됐어요! 물의 연쇄예요." },
  { a: "증기", b: "얼음", result: "안개", chain: 2, msg: "증기가 차갑게 식어 안개로 번졌어요." },
  { a: "진흙", b: "불", result: "도자기", chain: 2, msg: "진흙을 구워 도자기가 됐어요! 흙의 연쇄예요." },
  { a: "진흙", b: "태양", result: "벽돌", chain: 2, msg: "진흙이 햇볕에 말라 단단한 벽돌이 됐어요!" },
  { a: "유리", b: "태양", result: "렌즈", chain: 2, msg: "유리를 둥글게 갈아 빛을 모으는 렌즈가 됐어요!" },
  { a: "유리", b: "은", result: "거울", chain: 2, msg: "유리 뒤에 은을 입혀 거울이 됐어요!" },
  { a: "검", b: "방패", result: "기사", chain: 2, msg: "검과 방패를 든 기사님이 탄생했어요! 철의 연쇄예요." },
  { a: "밀가루", b: "물", result: "반죽", chain: 2, msg: "밀가루에 물을 부어 반죽을 치댔어요. 빵의 시작이에요!" },
  { a: "바다", b: "태양", result: "소금", chain: 2, msg: "바닷물이 햇볕에 말라 소금이 남았어요!" },
  { a: "숲", b: "불", result: "숯", chain: 2, msg: "숲의 나무가 천천히 타서 숯이 됐어요." },
  { a: "눈사람", b: "태양", result: "물", chain: 2, msg: "눈사람이 햇살에 녹아 물웅덩이가 됐어요. 조금 아쉬워요." },
  { a: "비", b: "얼음", result: "우박", chain: 2, msg: "빗방울이 얼어붙어 우박이 쏟아져요!" },
  { a: "숲", b: "도끼", result: "종이", chain: 2, msg: "숲의 나무를 잘게 쪼개 펄프로 만들어 종이가 됐어요!" },
  { a: "책", b: "별", result: "지도", chain: 2, msg: "책 속 별자리를 옮겨 별 지도가 됐어요!" },
  { a: "비", b: "번개", result: "소나기", chain: 2, msg: "번개를 품은 비구름이 소나기를 쏟아내요!" },
  { a: "모래", b: "물", result: "진흙", chain: 2, msg: "모래에 물을 부으니 진흙처럼 뭉쳐요." },
  { a: "꽃", b: "태양", result: "해바라기", chain: 2, msg: "꽃이 해만 바라보며 해바라기로 자랐어요!" },
  { a: "숲", b: "바람", result: "단풍", chain: 2, msg: "숲이 가을바람에 물들어 단풍으로 빛나요." },
  { a: "진흙", b: "꽃", result: "화분", chain: 2, msg: "진흙 화분에 꽃을 심었어요!" },
  { a: "꿀", b: "눈", result: "아이스크림", chain: 2, msg: "눈처럼 고운 얼음에 꿀을 뿌려 달콤한 아이스크림 완성!" },
  /* ── 3단 · 심화 연쇄 (10) — 2단 결과가 재료가 된다 ── */
  { a: "렌즈", b: "별", result: "망원경", chain: 3, msg: "렌즈로 별을 당겨 보는 망원경 완성! 3단 연쇄예요!" },
  { a: "벽돌", b: "벽돌", result: "집", chain: 3, msg: "벽돌을 쌓고 쌓아 집이 됐어요! 3단 연쇄 완성!" },
  { a: "기사", b: "왕관", result: "왕", chain: 3, msg: "기사가 왕관을 받아 왕이 됐어요! 3단 연쇄예요!" },
  { a: "왕", b: "보석", result: "왕관", chain: 3, msg: "왕의 보석이 박혀 왕관이 빛나요. 연쇄가 순환해요!" },
  { a: "반죽", b: "불", result: "빵", chain: 3, msg: "반죽을 구워 빵이 됐어요! 이제 샌드위치까지 한 걸음!" },
  { a: "반죽", b: "계란", result: "케이크", chain: 3, msg: "반죽에 계란을 섞어 케이크가 부풀었어요!" },
  { a: "샌드위치", b: "토마토", result: "햄버거", chain: 3, msg: "샌드위치에 토마토를 더해 햄버거처럼 풍성해졌어요!" },
  { a: "숯", b: "철", result: "검", chain: 3, msg: "숯불로 철을 달궈 검을 벼렸어요. 숲에서 검까지, 긴 연쇄예요!" },
  { a: "지도", b: "별", result: "은하", chain: 3, msg: "별 지도를 펼치자 그 너머 은하까지 이어져요!" },
  { a: "안개", b: "태양", result: "무지개", chain: 3, msg: "안개가 햇살에 걷히며 옅은 무지개가 떴어요!" },
  { a: "돌", b: "별", result: "운석", chain: 1, msg: "하늘에서 운석이 떨어졌어요!" },
  /* ── v4.2 대연금술 2탄 ── 무한 합성에만 있던 3개 조합법을 연구소 정식 조합법으로도
     올린다. 연구소 "+" 입력·연쇄 입력은 COMBOS만 조회하므로, 이 3개가 없으면
     대연금술 게이트·연출에 도달하지 못한다(무한 합성본은 그대로 둔다). */
  { a: "폭풍", b: "불", result: "번개", chain: 1, msg: "폭풍 속에서 불같은 번개가 번쩍!" },
  { a: "불", b: "흙", result: "용암", chain: 1, msg: "흙이 불에 녹아 용암이 흘러내려요!" },
  { a: "빛", b: "회오리", result: "오로라", chain: 1, msg: "빛이 하늘에서 휘어져 오로라가 됐어요!" },
  /* ── v4.3 대연금술 3탄 ── 8종 세트의 마지막 3종. 운석과 같은 1단 합성 전용 조합법이다. */
  { a: "돌", b: "흙", result: "지진", chain: 1, msg: "돌과 흙이 크게 흔들려 지진이 났어요!" },
  { a: "별", b: "불", result: "혜성", chain: 1, msg: "별에 불이 붙어 꼬리를 단 혜성이 됐어요!" },
  { a: "별", b: "어둠", result: "블랙홀", chain: 1, msg: "별이 어둠에 삼켜져 블랙홀이 됐어요!" },
  /* ── PLAN-v4 (v5.6 방향) ── 동음이의어 폐지(종·기·손)로 일반 조합으로 이동한 2개.
     기·손은 이제 평문 단어라 팝업 없이 합성된다. B06/B08 최종본 문장 그대로. */
  { a: "기", b: "운", result: "기운", chain: 1, msg: "기와 운이 만나 몸속 힘인 기운이 됐어요!" },
  { a: "손", b: "목", result: "손목", chain: 1, msg: "손과 목이 만나 손과 팔을 잇는 손목이 됐어요!" },
  /* ── v5.11 스토리 확장 (Neon 2026-11-23) ── 스토리 조합 12개 추가 (59→71).
     알돌 선택: 스토리 12개만. 무한 20개·동음이의어 3개는 미적용. */
  { a: "태양", b: "구름", result: "노을", chain: 2, msg: "하늘이 붉고 따뜻하게 물드는 예쁜 노을이 됐어요!" },
  { a: "종이", b: "물", result: "종이배", chain: 2, msg: "물 위를 둥둥 떠다니는 귀여운 종이배가 됐어요!" },
  { a: "집", b: "왕", result: "성", chain: 3, msg: "왕이 지내는 크고 멋진 성이 세워졌어요!" },
  { a: "빵", b: "토마토", result: "피자", chain: 3, msg: "고소하고 새콤달콤한 맛있는 피자가 완성됐어요!" },
  { a: "반죽", b: "꿀", result: "쿠키", chain: 2, msg: "달콤하고 바삭바삭한 쿠키가 구워졌어요!" },
  { a: "얼음", b: "바람", result: "서리", chain: 1, msg: "풀잎 위에 하얗게 내려앉은 반짝이는 서리가 됐어요!" },
  { a: "나무", b: "꽃", result: "벚꽃", chain: 2, msg: "봄바람에 흩날리는 분홍빛 벚꽃이 피어났어요!" },
  { a: "나무", b: "눈", result: "소나무", chain: 1, msg: "하얀 눈 속에서도 늘 푸른 소나무가 됐어요!" },
  { a: "꿀", b: "불", result: "양초", chain: 2, msg: "어두운 방을 환하게 비춰 주는 양초가 됐어요!" },
  { a: "철", b: "바람", result: "비행기", chain: 1, msg: "하늘을 씽씽 날아오르는 멋진 비행기가 됐어요!" },
  { a: "나무", b: "빛", result: "산소", chain: 1, msg: "우리가 숨 쉬는 깨끗하고 상쾌한 산소가 만들어졌어요!" },
  { a: "망원경", b: "책", result: "과학자", chain: 3, msg: "우주와 자연의 비밀을 푸는 똑똑한 과학자가 됐어요!" }
];

const DAILY_EXTRA_MATERIALS = ["돌", "철", "나무", "빛", "어둠", "구름", "눈", "번개", "증기", "얼음", "꽃", "별"];

const DAILY_COMBO_BY_KEY = {};

INF_COMBOS.forEach(c => { DAILY_COMBO_BY_KEY[[c.a, c.b].sort().join("+") + "=" + c.result] = c; });

const BATTLE_ALL_COMBOS = (() => {
  const _seen = new Set(INF_COMBOS.map(c => [c.a, c.b].sort().join("+")));
  return [...INF_COMBOS, ...COMBOS.filter(c => !_seen.has([c.a, c.b].sort().join("+")))];
})();

BATTLE_ALL_COMBOS.forEach(c => { const k = [c.a, c.b].sort().join("+") + "=" + c.result; if (!(k in DAILY_COMBO_BY_KEY)) DAILY_COMBO_BY_KEY[k] = c; });

function kstDateStr(d) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d || new Date());
    const p = {};
    parts.forEach(x => { p[x.type] = x.value; });
    if (p.year && p.month && p.day) return p.year + "-" + p.month + "-" + p.day;
  } catch (e) { /* 아래 폴백 사용 */ }
  /* 폴백: UTC+9 고정 오프셋으로 계산 (한국은 서머타임이 없다) */
  const t = new Date((d || new Date()).getTime() + 9 * 60 * 60 * 1000);
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(t.getUTCDate()).padStart(2, "0");
  return t.getUTCFullYear() + "-" + mm + "-" + dd;
}

function todayKSTStr() { return kstDateStr(new Date()); }

function shiftDateStr(dateStr, delta) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
  if (!m) return dateStr;
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + delta));
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(t.getUTCDate()).padStart(2, "0");
  return t.getUTCFullYear() + "-" + mm + "-" + dd;
}

function hashDateStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function dailyWeekday(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
  if (!m) return 1;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay(); /* 0=일 … 6=토 */
}

function dailyIsWeekend(dateStr) { const d = dailyWeekday(dateStr); return d === 0 || d === 6; }

function dailyExtraMaterials(dateStr, hOverride) {
  const h = (hOverride === undefined) ? hashDateStr(dateStr) : (hOverride >>> 0);
  const i1 = h % 12;
  let i2 = ((h >> 8) % 12);
  if (i2 === i1) i2 = (i2 + 1) % 12;
  return [DAILY_EXTRA_MATERIALS[i1], DAILY_EXTRA_MATERIALS[i2]];
}

function dailyMaterials(dateStr, hOverride) {
  return INF_BASES.concat(dailyExtraMaterials(dateStr, hOverride));
}

function dailyComboReach(materials) {
  const reach = {};
  materials.forEach(m => { reach[m] = new Set(); });
  let changed = true, guard = 0;
  while (changed && guard++ < 300) {
    changed = false;
    for (const c of BATTLE_ALL_COMBOS) {
      if (!reach[c.a] || !reach[c.b]) continue;
      const s = new Set(reach[c.a]);
      reach[c.b].forEach(k => s.add(k));
      s.add([c.a, c.b].sort().join("+") + "=" + c.result);
      if (!reach[c.result] || s.size < reach[c.result].size) { reach[c.result] = s; changed = true; }
    }
  }
  return reach;
}

function dailyComboPath(reach, target) {
  const set = reach[target];
  if (!set) return null;
  const steps = [];
  set.forEach(k => { const c = DAILY_COMBO_BY_KEY[k]; if (c) steps.push(c); });
  steps.sort((x, y) => {
    const sx = reach[x.result] ? reach[x.result].size : 0;
    const sy = reach[y.result] ? reach[y.result].size : 0;
    if (sx !== sy) return sx - sy;
    return (x.result < y.result ? -1 : x.result > y.result ? 1 : 0);
  });
  return steps;
}

function dailyTierA(dateStr) {
  const h = hashDateStr(dateStr);
  const base = dailyIsWeekend(dateStr) ? 3 : 2;
  return base + (h % 2); /* 평일 파 2~3, 주말 파 3~4 */
}

function dailyComboTarget(dateStr) {
  const h = hashDateStr(dateStr);
  const materials = dailyMaterials(dateStr);
  const reach = dailyComboReach(materials);
  const tier = dailyTierA(dateStr);
  let candidates = Object.keys(reach).filter(w => reach[w].size === tier && materials.indexOf(w) < 0);
  candidates.sort();
  let par = tier;
  if (!candidates.length) {
    /* 폴백: 티어 ±1 안에서, 그래도 없으면 도달 가능한 가장 작은 파 */
    [tier - 1, tier + 1, tier - 2, tier + 2].forEach(p => {
      if (candidates.length || p < 1 || p > 5) return;
      candidates = Object.keys(reach).filter(w => reach[w].size === p && materials.indexOf(w) < 0);
      candidates.sort();
      if (candidates.length) par = p;
    });
  }
  if (!candidates.length) {
    candidates = Object.keys(reach).filter(w => reach[w].size >= 1 && materials.indexOf(w) < 0);
    candidates.sort();
    if (candidates.length) par = reach[candidates[0]].size;
  }
  if (!candidates.length) return null;
  const target = candidates[h % candidates.length];
  return { target, par, materials, reach, path: dailyComboPath(reach, target) };
}

// ---------- v1.1 대전 목표 뽑기 (설계 §v1.1-A) ----------
// 풀: 그날 재료로 만들 수 있고 파 2~4인 단어. 시드 = hash(roomCode + ":" + matchNo + ":" + round).
// 같은 방·같은 판·같은 라운드면 양쪽이 같은 주제어를 본다. 날짜가 바뀌면 그날 재료 기준이라 항상 풀 수 있다.
export function battleTargetPool(dateStr) {
  const materials = dailyMaterials(dateStr);
  const reach = dailyComboReach(materials);
  const pool = Object.keys(reach).filter(
    (w) => reach[w].size >= 2 && reach[w].size <= 4 && materials.indexOf(w) < 0
  );
  pool.sort();
  return { pool, materials, reach };
}

export function battlePickTarget(roomCode, matchNo, round, dateStr) {
  const { pool, materials, reach } = battleTargetPool(dateStr);
  if (!pool.length) return null;
  const seed = hashDateStr(roomCode + ":" + matchNo + ":" + round);
  const target = pool[seed % pool.length];
  return { target, par: reach[target].size, materials, path: dailyComboPath(reach, target) };
}

// 원문 그대로 추출한 선언들을 외부에서 쓸 수 있게 내보낸다 (원문은 수정하지 않음).
export {
  INF_BASES, INF_COMBOS, COMBOS, DAILY_EXTRA_MATERIALS, DAILY_COMBO_BY_KEY, BATTLE_ALL_COMBOS,
  kstDateStr, todayKSTStr, shiftDateStr, hashDateStr,
  dailyWeekday, dailyIsWeekend, dailyExtraMaterials, dailyMaterials,
  dailyComboReach, dailyComboPath, dailyTierA, dailyComboTarget,
};
