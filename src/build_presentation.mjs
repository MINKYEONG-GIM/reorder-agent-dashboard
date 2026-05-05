import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactPath =
  "file:///C:/Users/kim_minkyeong07/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const {
  Presentation,
  PresentationFile,
  column,
  row,
  grid,
  layers,
  panel,
  text,
  shape,
  rule,
  fill,
  hug,
  fixed,
  wrap,
  fr,
  auto,
} = await import(artifactPath);

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, "output");
const previewDir = path.join(outputDir, "previews");
const jsonPath = path.join(outputDir, "similar_item_forecast.json");
const pptxPath = path.join(outputDir, "vibe_coding_sales_forecast_bot.pptx");

const palette = {
  bg: "#F7F3EB",
  ink: "#142033",
  blue: "#0E5BD7",
  sky: "#BFE6FF",
  mint: "#CBEFD8",
  peach: "#FFD8A8",
  rose: "#FF6B7A",
  olive: "#7A8B49",
  line: "#D6DCE7",
  sub: "#6B7890",
  white: "#FFFFFF",
};

async function loadDemoData() {
  const raw = await fs.readFile(jsonPath, "utf8");
  return JSON.parse(raw);
}

function bg() {
  return layers(
    { width: fill, height: fill },
    [
      shape({
        width: fill,
        height: fill,
        fill: palette.bg,
      }),
    ],
  );
}

function titleBlock(title, subtitle, accent = palette.blue) {
  return column(
    { width: fill, height: hug, gap: 10 },
    [
      text(title, {
        width: fill,
        height: hug,
        style: { fontFace: "Malgun Gothic", fontSize: 48, bold: true, color: palette.ink },
      }),
      text(subtitle, {
        width: wrap(1380),
        height: hug,
        style: { fontFace: "Malgun Gothic", fontSize: 22, color: palette.sub },
      }),
      rule({ width: fixed(200), stroke: accent, weight: 5 }),
    ],
  );
}

function statCard(number, label, accent) {
  return panel(
    {
      width: fill,
      height: hug,
      fill: palette.white,
      line: { color: palette.line, width: 1 },
      borderRadius: 24,
      padding: 24,
    },
    column(
      { width: fill, height: hug, gap: 8 },
      [
        text(number, {
          width: fill,
          height: hug,
          style: { fontFace: "Bahnschrift", fontSize: 42, bold: true, color: accent },
        }),
        text(label, {
          width: fill,
          height: hug,
          style: { fontFace: "Malgun Gothic", fontSize: 20, color: palette.ink },
        }),
      ],
    ),
  );
}

function stepCard(step, title, body, accent) {
  return panel(
    {
      width: fill,
      height: hug,
      fill: palette.white,
      line: { color: palette.line, width: 1 },
      borderRadius: 24,
      padding: 24,
    },
    column(
      { width: fill, height: hug, gap: 10 },
      [
        text(step, {
          width: fill,
          height: hug,
          style: { fontFace: "Bahnschrift", fontSize: 18, bold: true, color: accent },
        }),
        text(title, {
          width: fill,
          height: hug,
          style: { fontFace: "Malgun Gothic", fontSize: 28, bold: true, color: palette.ink },
        }),
        text(body, {
          width: fill,
          height: hug,
          style: { fontFace: "Malgun Gothic", fontSize: 20, color: palette.sub },
        }),
      ],
    ),
  );
}

function promptCard(title, prompt, accent) {
  return panel(
    {
      width: fill,
      height: hug,
      fill: palette.white,
      line: { color: accent, width: 1 },
      borderRadius: 22,
      padding: 20,
    },
    column(
      { width: fill, height: hug, gap: 10 },
      [
        text(title, {
          width: fill,
          height: hug,
          style: { fontFace: "Malgun Gothic", fontSize: 22, bold: true, color: accent },
        }),
        text(prompt, {
          width: fill,
          height: hug,
          style: { fontFace: "Consolas", fontSize: 16, color: palette.ink },
        }),
      ],
    ),
  );
}

function tinyLabel(textValue, accent) {
  return panel(
    {
      width: fill,
      height: hug,
      fill: accent,
      borderRadius: 18,
      padding: { x: 16, y: 10 },
    },
    text(textValue, {
      width: fill,
      height: hug,
      style: { fontFace: "Malgun Gothic", fontSize: 18, bold: true, color: palette.ink },
    }),
  );
}

function forecastTable(items) {
  const header = row(
    { width: fill, height: hug, gap: 16 },
    [
      text("예측 대상", { width: fixed(300), height: hug, style: { fontFace: "Malgun Gothic", fontSize: 18, bold: true, color: palette.blue } }),
      text("참조 수", { width: fixed(120), height: hug, style: { fontFace: "Malgun Gothic", fontSize: 18, bold: true, color: palette.blue } }),
      text("평균 참조 판매량", { width: fixed(180), height: hug, style: { fontFace: "Malgun Gothic", fontSize: 18, bold: true, color: palette.blue } }),
      text("올해 예측 판매량", { width: fixed(180), height: hug, style: { fontFace: "Malgun Gothic", fontSize: 18, bold: true, color: palette.blue } }),
      text("가장 비슷한 작년 아이템", { width: fixed(320), height: hug, style: { fontFace: "Malgun Gothic", fontSize: 18, bold: true, color: palette.blue } }),
    ],
  );

  const bodyRows = items.flatMap((item) => [
    row(
      { width: fill, height: hug, gap: 16 },
      [
        text(item.target_item, { width: fixed(300), height: hug, style: { fontFace: "Malgun Gothic", fontSize: 18, color: palette.ink } }),
        text(String(item.reference_count), { width: fixed(120), height: hug, style: { fontFace: "Bahnschrift", fontSize: 18, color: palette.ink } }),
        text(String(item.avg_reference_units), { width: fixed(180), height: hug, style: { fontFace: "Bahnschrift", fontSize: 18, color: palette.ink } }),
        text(String(item.predicted_units_this_year), { width: fixed(180), height: hug, style: { fontFace: "Bahnschrift", fontSize: 18, bold: true, color: palette.rose } }),
        text(item.top_reference, { width: fixed(320), height: hug, style: { fontFace: "Malgun Gothic", fontSize: 18, color: palette.ink } }),
      ],
    ),
    rule({ width: fill, stroke: palette.line, weight: 1 }),
  ]);

  return panel(
    {
      width: fill,
      height: hug,
      fill: palette.white,
      line: { color: palette.line, width: 1 },
      borderRadius: 24,
      padding: 24,
    },
    column({ width: fill, height: hug, gap: 12 }, [header, rule({ width: fill, stroke: palette.blue, weight: 2 }), ...bodyRows]),
  );
}

function fullPrompt(prompt) {
  return panel(
    {
      width: fill,
      height: hug,
      fill: palette.white,
      line: { color: palette.blue, width: 1 },
      borderRadius: 28,
      padding: 28,
    },
    text(prompt, {
      width: fill,
      height: hug,
      style: { fontFace: "Consolas", fontSize: 20, color: palette.ink },
    }),
  );
}

async function build() {
  await fs.mkdir(previewDir, { recursive: true });
  const demo = await loadDemoData();
  const forecasts = demo.forecasts;

  const presentation = Presentation.create({
    slideSize: { width: 1920, height: 1080 },
  });

  const slide1 = presentation.slides.add();
  slide1.compose(
    layers(
      { width: fill, height: fill },
      [
        bg(),
        grid(
          {
            width: fill,
            height: fill,
            columns: [fr(1.05), fr(0.95)],
            rows: [auto, fr(1), auto],
            padding: { x: 88, y: 72 },
            columnGap: 48,
            rowGap: 28,
          },
          [
            column(
              { width: fill, height: hug, gap: 16, rowSpan: 2 },
              [
                text("코덱스로 바이브코딩", {
                  width: fill,
                  height: hug,
                  style: { fontFace: "Malgun Gothic", fontSize: 74, bold: true, color: palette.ink },
                }),
                text("작년 유사 아이템의 판매량·할인율·판매액을 넣으면 올해 판매량을 예측해주는 봇 만들기", {
                  width: wrap(760),
                  height: hug,
                  style: { fontFace: "Malgun Gothic", fontSize: 30, color: palette.sub },
                }),
                rule({ width: fixed(220), stroke: palette.blue, weight: 6 }),
                text("이 발표에서 보여주는 것", {
                  width: fill,
                  height: hug,
                  style: { fontFace: "Malgun Gothic", fontSize: 26, bold: true, color: palette.blue },
                }),
                text("1. 봇 아이디어를 아주 쉽게 쪼개기", {
                  width: fill,
                  height: hug,
                  style: { fontFace: "Malgun Gothic", fontSize: 24, color: palette.ink },
                }),
                text("2. 코덱스에게 어떻게 말하면 되는지 프롬프트로 배우기", {
                  width: fill,
                  height: hug,
                  style: { fontFace: "Malgun Gothic", fontSize: 24, color: palette.ink },
                }),
                text("3. 실제 예측 bot 예시와 결과 보기", {
                  width: fill,
                  height: hug,
                  style: { fontFace: "Malgun Gothic", fontSize: 24, color: palette.ink },
                }),
              ],
            ),
            column(
              { width: fill, height: hug, gap: 22, padding: { top: 50 } },
              [
                statCard(String(demo.summary.target_item_count), "올해 예측한 타깃 아이템 수", palette.blue),
                statCard(String(demo.summary.reference_row_count), "작년 유사 아이템 참조 행 수", palette.olive),
                statCard(String(demo.summary.total_predicted_units), "샘플 기준 총 예측 판매량", palette.rose),
              ],
            ),
            text("Vibe Coding Workshop Deck", {
              width: fill,
              height: hug,
              style: { fontFace: "Bahnschrift", fontSize: 18, color: palette.sub },
            }),
            text(new Date().toISOString().slice(0, 10), {
              width: fill,
              height: hug,
              style: { fontFace: "Bahnschrift", fontSize: 18, color: palette.sub },
            }),
          ],
        ),
      ],
    ),
    { frame: { left: 0, top: 0, width: 1920, height: 1080 }, baseUnit: 8 },
  );

  const slide2 = presentation.slides.add();
  slide2.compose(
    column(
      { width: fill, height: fill, padding: 88, gap: 30 },
      [
        titleBlock("이 봇은 뭐를 해주나", "입력 3개만 이해하면 끝입니다. 작년 유사 아이템 데이터로 올해 판매량을 쉽게 추정합니다.", palette.olive),
        row(
          { width: fill, height: hug, gap: 20 },
          [
            tinyLabel("입력 1: 작년 판매량", palette.peach),
            tinyLabel("입력 2: 작년/올해 할인율", palette.sky),
            tinyLabel("입력 3: 작년 판매액", palette.mint),
            tinyLabel("출력: 올해 예상 판매량", "#FFD3DA"),
          ],
        ),
        row(
          { width: fill, height: hug, gap: 24 },
          [
            stepCard("A", "작년 데이터 보기", "유사했던 아이템이 작년에 몇 개 팔렸는지, 얼마에 팔렸는지 봅니다.", palette.peach),
            stepCard("B", "올해 조건 반영", "올해 할인율이 더 큰지, 시장 분위기가 더 좋은지 같은 변수를 살짝 더합니다.", palette.blue),
            stepCard("C", "가중 평균 내기", "가장 비슷한 아이템에 더 높은 점수를 주고 최종 예측 판매량을 만듭니다.", palette.rose),
          ],
        ),
        panel(
          {
            width: fill,
            height: hug,
            fill: palette.white,
            line: { color: palette.line, width: 1 },
            borderRadius: 26,
            padding: 24,
          },
          row(
            { width: fill, height: hug, gap: 24 },
            [
              column(
                { width: fixed(420), height: hug, gap: 8 },
                [
                  text("그림으로 보면", {
                    width: fill,
                    height: hug,
                    style: { fontFace: "Malgun Gothic", fontSize: 24, bold: true, color: palette.blue },
                  }),
                  text("유사 아이템 CSV", { width: fill, height: hug, style: { fontFace: "Malgun Gothic", fontSize: 22, color: palette.ink } }),
                  text("→ Codex에게 봇 만들어 달라고 말하기", { width: fill, height: hug, style: { fontFace: "Malgun Gothic", fontSize: 22, color: palette.ink } }),
                  text("→ Python 계산 로직 생성", { width: fill, height: hug, style: { fontFace: "Malgun Gothic", fontSize: 22, color: palette.ink } }),
                  text("→ 올해 판매량 예측 결과 확인", { width: fill, height: hug, style: { fontFace: "Malgun Gothic", fontSize: 22, color: palette.ink } }),
                ],
              ),
              text("CSV  ->  Prompt  ->  Bot  ->  Forecast", {
                width: fill,
                height: hug,
                style: { fontFace: "Bahnschrift", fontSize: 42, bold: true, color: palette.rose },
              }),
            ],
          ),
        ),
      ],
    ),
    { frame: { left: 0, top: 0, width: 1920, height: 1080 }, baseUnit: 8 },
  );

  const slide3 = presentation.slides.add();
  slide3.compose(
    column(
      { width: fill, height: fill, padding: 88, gap: 26 },
      [
        titleBlock("코덱스로 바이브코딩하는 가장 쉬운 순서", "코드를 완벽히 설계하려고 오래 고민하지 말고, 작은 요청을 여러 번 던지면서 모양을 잡으면 됩니다.", palette.blue),
        row(
          { width: fill, height: hug, gap: 18 },
          [
            stepCard("STEP 1", "데이터를 말해주기", "CSV에 어떤 열이 있는지 자연어로 설명합니다.", palette.blue),
            stepCard("STEP 2", "첫 버전 만들기", "일단 동작하는 Python 스크립트를 만들어 달라고 요청합니다.", palette.olive),
            stepCard("STEP 3", "결과를 보기 좋게", "JSON, CSV, 표 형태로 저장하도록 추가 요청합니다.", palette.rose),
            stepCard("STEP 4", "설명과 UI 붙이기", "이유 설명, 테스트, 간단한 웹 화면까지 이어서 요청합니다.", palette.peach),
          ],
        ),
        panel(
          {
            width: fill,
            height: hug,
            fill: palette.white,
            line: { color: palette.line, width: 1 },
            borderRadius: 26,
            padding: 24,
          },
          column(
            { width: fill, height: hug, gap: 12 },
            [
              text("처음 던질 한 줄 프롬프트", {
                width: fill,
                height: hug,
                style: { fontFace: "Malgun Gothic", fontSize: 24, bold: true, color: palette.blue },
              }),
              text(
                "작년 유사 아이템의 판매량, 할인율, 판매액을 기반으로 올해 유사 신상품의 판매량을 예측하는 아주 쉬운 Python 봇을 만들어줘. CSV를 읽고, 예측 판매량을 계산하고, 결과를 JSON과 CSV로 저장해줘.",
                {
                  width: fill,
                  height: hug,
                  style: { fontFace: "Consolas", fontSize: 22, color: palette.ink },
                },
              ),
            ],
          ),
        ),
        row(
          { width: fill, height: hug, gap: 24 },
          [
            statCard("작게 시작", "처음에는 정확도보다 동작하는 버전을 먼저 만듭니다.", palette.blue),
            statCard("계속 수정", "조금씩 프롬프트를 보태며 봇을 자랍니다.", palette.rose),
            statCard("설명을 요청", "왜 그렇게 예측했는지도 같이 말하게 만듭니다.", palette.olive),
          ],
        ),
      ],
    ),
    { frame: { left: 0, top: 0, width: 1920, height: 1080 }, baseUnit: 8 },
  );

  const slide4 = presentation.slides.add();
  slide4.compose(
    column(
      { width: fill, height: fill, padding: 88, gap: 28 },
      [
        titleBlock("예측 로직도 아주 쉽게 설명할 수 있다", "수학을 복잡하게 하지 않아도 됩니다. 작년 판매량에 올해 조건을 조금씩 곱해주는 방식부터 시작하면 충분합니다.", palette.rose),
        row(
          { width: fill, height: hug, gap: 24 },
          [
            panel(
              {
                width: fill,
                height: hug,
                fill: palette.white,
                line: { color: palette.line, width: 1 },
                borderRadius: 26,
                padding: 24,
              },
              column(
                { width: fill, height: hug, gap: 10 },
                [
                  text("그림 1. 기본 생각", {
                    width: fill,
                    height: hug,
                    style: { fontFace: "Malgun Gothic", fontSize: 24, bold: true, color: palette.blue },
                  }),
                  text("작년 판매량", { width: fill, height: hug, style: { fontFace: "Malgun Gothic", fontSize: 22, color: palette.ink } }),
                  text("× 할인 변화 효과", { width: fill, height: hug, style: { fontFace: "Malgun Gothic", fontSize: 22, color: palette.ink } }),
                  text("× 시장 트렌드 효과", { width: fill, height: hug, style: { fontFace: "Malgun Gothic", fontSize: 22, color: palette.ink } }),
                  text("× 유사도 가중치", { width: fill, height: hug, style: { fontFace: "Malgun Gothic", fontSize: 22, color: palette.ink } }),
                  text("= 올해 예측 판매량 후보", { width: fill, height: hug, style: { fontFace: "Malgun Gothic", fontSize: 22, bold: true, color: palette.rose } }),
                ],
              ),
            ),
            panel(
              {
                width: fill,
                height: hug,
                fill: palette.white,
                line: { color: palette.line, width: 1 },
                borderRadius: 26,
                padding: 24,
              },
              column(
                { width: fill, height: hug, gap: 10 },
                [
                  text("그림 2. 코덱스에게 시키는 말", {
                    width: fill,
                    height: hug,
                    style: { fontFace: "Malgun Gothic", fontSize: 24, bold: true, color: palette.olive },
                  }),
                  text("할인율 차이가 크면 판매량이 조금 더 오르도록 해줘.", { width: fill, height: hug, style: { fontFace: "Malgun Gothic", fontSize: 21, color: palette.ink } }),
                  text("가장 비슷한 참조 아이템에 더 높은 가중치를 줘.", { width: fill, height: hug, style: { fontFace: "Malgun Gothic", fontSize: 21, color: palette.ink } }),
                  text("결과와 함께 어떤 값이 가장 영향을 크게 줬는지 설명해줘.", { width: fill, height: hug, style: { fontFace: "Malgun Gothic", fontSize: 21, color: palette.ink } }),
                ],
              ),
            ),
          ],
        ),
        panel(
          {
            width: fill,
            height: hug,
            fill: palette.white,
            line: { color: palette.line, width: 1 },
            borderRadius: 26,
            padding: 24,
          },
          column(
            { width: fill, height: hug, gap: 10 },
            [
              text("예시 로직 프롬프트", {
                width: fill,
                height: hug,
                style: { fontFace: "Malgun Gothic", fontSize: 24, bold: true, color: palette.blue },
              }),
              text(
                "복잡한 머신러닝 말고, 작년 판매량을 기준으로 할인율 변화, 가격 변화, 트렌드 점수, 유사도 점수를 반영하는 쉬운 규칙 기반 예측 함수를 만들어줘. 수식이 읽기 쉬워야 하고, 각 값이 무엇을 의미하는지도 주석으로 설명해줘.",
                {
                  width: fill,
                  height: hug,
                  style: { fontFace: "Consolas", fontSize: 20, color: palette.ink },
                },
              ),
            ],
          ),
        ),
      ],
    ),
    { frame: { left: 0, top: 0, width: 1920, height: 1080 }, baseUnit: 8 },
  );

  const slide5 = presentation.slides.add();
  slide5.compose(
    column(
      { width: fill, height: fill, padding: 88, gap: 24 },
      [
        titleBlock("좋은 예시 프롬프트 모음 1", "초기 구현 단계에서 바로 써먹기 좋은 프롬프트입니다. 그대로 복붙해도 되고, 숫자와 파일명만 바꿔도 됩니다.", palette.blue),
        grid(
          {
            width: fill,
            height: hug,
            columns: [fr(1), fr(1)],
            rows: [auto, auto],
            columnGap: 24,
            rowGap: 20,
          },
          [
            promptCard("프롬프트 1. 첫 버전 만들기", "작년 유사 아이템 CSV를 읽어서 올해 판매량을 예측하는 Python 스크립트를 만들어줘. 입력은 판매량, 할인율, 판매액이고 출력은 올해 예상 판매량이야.", palette.blue),
            promptCard("프롬프트 2. CSV 구조 만들기", "이 봇에 필요한 CSV 컬럼을 초보자도 이해하기 쉽게 설계해줘. 컬럼명, 의미, 예시값을 표처럼 정리해줘.", palette.olive),
            promptCard("프롬프트 3. 아주 쉬운 로직", "머신러닝 없이도 이해할 수 있는 규칙 기반 예측 로직으로 만들어줘. 함수 이름과 변수 이름을 최대한 쉽게 써줘.", palette.rose),
            promptCard("프롬프트 4. 결과 저장", "예측 결과를 JSON과 CSV 둘 다 저장해줘. 각 타깃 아이템별로 예상 판매량, 참조 아이템 수, 가장 비슷한 아이템도 넣어줘.", palette.blue),
          ],
        ),
      ],
    ),
    { frame: { left: 0, top: 0, width: 1920, height: 1080 }, baseUnit: 8 },
  );

  const slide6 = presentation.slides.add();
  slide6.compose(
    column(
      { width: fill, height: fill, padding: 88, gap: 24 },
      [
        titleBlock("좋은 예시 프롬프트 모음 2", "이번에는 설명, 정리, 해석을 잘하게 만드는 프롬프트입니다.", palette.olive),
        grid(
          {
            width: fill,
            height: hug,
            columns: [fr(1), fr(1)],
            rows: [auto, auto],
            columnGap: 24,
            rowGap: 20,
          },
          [
            promptCard("프롬프트 5. 이유 설명 붙이기", "각 예측 결과마다 왜 그런 값이 나왔는지 한 줄 설명도 함께 만들어줘. 예를 들면 할인율 상승, 유사도 높은 참조 아이템, 트렌드 상승 같은 이유를 써줘.", palette.olive),
            promptCard("프롬프트 6. 주석 추가", "초보자가 읽어도 이해되도록 코드에 짧고 쉬운 주석을 붙여줘. 복잡한 설명보다 이 줄이 왜 필요한지만 알려줘.", palette.blue),
            promptCard("프롬프트 7. 표준 출력 보기 좋게", "터미널에 예측 결과를 표처럼 보기 좋게 출력해줘. 상위 3개 아이템은 강조해서 보여줘.", palette.rose),
            promptCard("프롬프트 8. 발표용 설명", "이 코드를 비개발자에게 발표한다고 생각하고, 코드가 무슨 일을 하는지 5문장으로 쉽게 설명해줘.", palette.olive),
          ],
        ),
      ],
    ),
    { frame: { left: 0, top: 0, width: 1920, height: 1080 }, baseUnit: 8 },
  );

  const slide7 = presentation.slides.add();
  slide7.compose(
    column(
      { width: fill, height: fill, padding: 88, gap: 24 },
      [
        titleBlock("좋은 예시 프롬프트 모음 3", "디버깅, 고도화, 화면 만들기까지 이어가는 프롬프트입니다.", palette.rose),
        grid(
          {
            width: fill,
            height: hug,
            columns: [fr(1), fr(1)],
            rows: [auto, auto],
            columnGap: 24,
            rowGap: 20,
          },
          [
            promptCard("프롬프트 9. 에러 수정", "이 코드가 에러 없이 실행되도록 고쳐줘. 수정한 이유를 한 줄씩 설명해줘.", palette.rose),
            promptCard("프롬프트 10. 테스트 추가", "간단한 샘플 데이터로 이 예측 함수가 동작하는지 확인하는 테스트 코드를 만들어줘.", palette.blue),
            promptCard("프롬프트 11. Streamlit 화면", "비개발자도 써볼 수 있게 CSV 업로드 후 예측 결과를 보여주는 아주 간단한 Streamlit 화면을 만들어줘.", palette.olive),
            promptCard("프롬프트 12. 더 현실적으로", "최소 주문 수량, 재고 상황, 가격 인상 가능성 같은 현실 변수도 추가할 수 있게 구조를 바꿔줘.", palette.rose),
          ],
        ),
      ],
    ),
    { frame: { left: 0, top: 0, width: 1920, height: 1080 }, baseUnit: 8 },
  );

  const slide8 = presentation.slides.add();
  slide8.compose(
    column(
      { width: fill, height: fill, padding: 88, gap: 26 },
      [
        titleBlock("예시 bot 결과", "샘플 데이터 3개 타깃 아이템을 기준으로 예측한 결과입니다. 발표에서는 이 표를 보여주면서 로직을 설명하면 됩니다.", palette.blue),
        row(
          { width: fill, height: hug, gap: 24 },
          [
            statCard(String(demo.summary.target_item_count), "예측 대상 아이템 수", palette.blue),
            statCard(String(demo.summary.reference_row_count), "참조한 작년 유사 아이템 수", palette.olive),
            statCard(String(demo.summary.total_predicted_units), "총 예측 판매량", palette.rose),
          ],
        ),
        forecastTable(forecasts),
        text(`예시 프롬프트: ${demo.example_prompt}`, {
          width: wrap(1600),
          height: hug,
          style: { fontFace: "Malgun Gothic", fontSize: 20, color: palette.sub },
        }),
      ],
    ),
    { frame: { left: 0, top: 0, width: 1920, height: 1080 }, baseUnit: 8 },
  );

  const slide9 = presentation.slides.add();
  slide9.compose(
    column(
      { width: fill, height: fill, padding: 88, gap: 26 },
      [
        titleBlock("마지막으로, 이 프롬프트 하나면 시작할 수 있다", "정말 시간이 없으면 이 문장을 그대로 코덱스에 넣고 출발해도 됩니다.", palette.olive),
        fullPrompt(
          "작년 유사 아이템의 판매량, 할인율, 판매액이 들어있는 CSV를 읽어서 올해 신상품 또는 유사 아이템의 판매량을 예측하는 아주 쉬운 Python 봇을 만들어줘. 초보자도 이해할 수 있는 규칙 기반 로직을 사용하고, 할인율 변화와 유사도 점수를 반영해줘. 결과는 타깃 아이템별 예상 판매량, 가장 비슷한 참조 아이템, 예측 이유 한 줄 설명을 포함해서 JSON과 CSV로 저장해줘. 코드에는 쉬운 주석을 달고, 실행 방법도 같이 알려줘. 가능하면 Streamlit 미니 화면으로 확장하는 다음 단계 아이디어도 덧붙여줘."
        ),
        row(
          { width: fill, height: hug, gap: 24 },
          [
            stepCard("TIP 1", "짧게 말해도 된다", "처음부터 완벽한 요구사항을 쓰지 않아도 됩니다. 일단 만들고 계속 고치면 됩니다.", palette.blue),
            stepCard("TIP 2", "결과를 계속 보여달라", "코드만 말고 샘플 출력, 저장 파일, 설명 문장까지 같이 달라고 하면 훨씬 편합니다.", palette.rose),
            stepCard("TIP 3", "발표 준비도 시킬 수 있다", "코드 설명, 발표 대본, 예상 질문 답변까지 코덱스에 같이 요청할 수 있습니다.", palette.olive),
          ],
        ),
      ],
    ),
    { frame: { left: 0, top: 0, width: 1920, height: 1080 }, baseUnit: 8 },
  );

  const pptxBlob = await PresentationFile.exportPptx(presentation);
  await pptxBlob.save(pptxPath);

  for (let i = 0; i < presentation.slides.count; i += 1) {
    const slide = presentation.slides.getItem(i);
    const pngBlob = await slide.export({ format: "png" });
    await fs.writeFile(
      path.join(previewDir, `slide-${String(i + 1).padStart(2, "0")}.png`),
      new Uint8Array(await pngBlob.arrayBuffer()),
    );
  }

  console.log(`Wrote ${pptxPath}`);
  console.log(`Wrote previews to ${previewDir}`);
}

await build();
