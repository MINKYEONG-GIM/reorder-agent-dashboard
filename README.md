# Inventory Planning Dashboard

`raw_file`, `item_plc`, `center_stock`를 바탕으로 주차별 SKU 판매/입고/재고소진율을 미리보고, 시즌 종료 전 부족 수량과 발주 시점/발주량을 계산하는 Next.js 앱입니다.

## 왜 구조를 나눴는가

원본 테이블은 그대로 두고, 아래 계산용 계층을 추가하는 것이 안전합니다.

1. `sku_weekly_base`
   `raw_file` + `item_plc`를 합쳐 주차별 SKU 기본 마트를 만듭니다.
2. `sku_weekly_forecast_plan`
   적재 전 미리보기와 적재 후 검증에 모두 쓰는 주차별 예측 결과 테이블입니다.
3. `store_season_need`
   센터/매장별 시즌 종료 시점 부족 수량을 저장합니다.
4. `purchase_recommendation`
   발주 주차, 발주량, 부족 예상 주차를 저장합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

환경변수가 없으면 샘플 데이터로 화면이 뜹니다.

## Supabase 연결

`.env.local`에 아래 값을 넣어주세요.

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
PREVIEW_STYLE_CODE=STY-2401
```

## SQL 적용 순서

1. [sql/01_schema_redesign.sql](/C:/Users/kim_minkyeong07/Documents/New%20project%204/sql/01_schema_redesign.sql)
2. [sql/03_refresh_base_from_sources.sql](/C:/Users/kim_minkyeong07/Documents/New%20project%204/sql/03_refresh_base_from_sources.sql)
3. [sql/02_build_forecast_plan.sql](/C:/Users/kim_minkyeong07/Documents/New%20project%204/sql/02_build_forecast_plan.sql)

먼저 `select public.refresh_sku_weekly_base('STY-2401');`로 원본을 주차 마트로 만든 뒤
`select public.build_sku_forecast_plan('STY-2401');`를 호출하면 계산 결과가 적재됩니다.

## Vercel 배포

1. GitHub에 이 저장소를 push
2. Vercel에서 GitHub 저장소 import
3. Environment Variables에 Supabase 값 등록
4. Deploy

## 화면에서 먼저 보는 항목

- 스타일 1개 기준 주차별 SKU 판매량
- 센터 + 매장 총 보유재고
- 누적입고량 / 누적판매량
- 재고소진율
- 시즌 종료 전 부족수량
- 추천 발주 주차 / 추천 발주량
