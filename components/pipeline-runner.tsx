"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initialStyles?: string;
};

type PipelineResponse = {
  ok: true;
  summary: {
    styles: string[];
    batchSize: number;
    totalBatches: number;
    rawWeeklySalesCount: number;
    styleRatioWeeklyCount: number;
    skuWeeklyForecastCount: number;
    styleColorWeeklyNeedCount: number;
    skuReorderPlanCount: number;
  };
};

type PipelineErrorResponse = {
  error?: string;
};

export function PipelineRunner({ initialStyles = "" }: Props) {
  const router = useRouter();
  const [styles, setStyles] = useState(initialStyles);
  const [adminToken, setAdminToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleRun() {
    const normalized = styles.trim();
    if (!normalized) {
      setIsError(true);
      setMessage("적재할 스타일 코드를 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setIsError(false);
    setMessage("적재 파이프라인을 실행하고 있습니다...");

    try {
      const response = await fetch("/api/build-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          styles: normalized,
          adminToken: adminToken.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as PipelineResponse | PipelineErrorResponse;

      if (!response.ok || !("ok" in payload)) {
        const errorMessage = "error" in payload ? payload.error : undefined;
        throw new Error(errorMessage ?? "적재 실행에 실패했습니다.");
      }

      const summary = payload.summary;
      setMessage(
        `완료: ${summary.totalBatches}개 배치(${summary.batchSize}개씩)로 처리했고, 원천 ${summary.rawWeeklySalesCount}건, 비율 ${summary.styleRatioWeeklyCount}건, 예측 ${summary.skuWeeklyForecastCount}건, 수요 ${summary.styleColorWeeklyNeedCount}건, 발주 ${summary.skuReorderPlanCount}건을 적재했습니다.`,
      );

      startTransition(() => {
        const firstStyle = summary.styles[0];
        if (summary.styles.length === 1 && firstStyle) {
          router.push(`/?q=${encodeURIComponent(firstStyle)}`);
        } else {
          router.refresh();
        }
      });
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "적재 실행에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="pipeline-card">
      <div className="pipeline-copy">
        <span className="kicker">적재 실행</span>
        <strong>화면에서 바로 계산 테이블 적재</strong>
        <p>스타일 코드를 입력하고 실행하면 `raw_weekly_sales`부터 `sku_reorder_plan`까지 한 번에 다시 계산합니다.</p>
      </div>

      <div className="pipeline-controls">
        <textarea
          className="pipeline-input"
          value={styles}
          onChange={(event) => setStyles(event.target.value)}
          rows={3}
          placeholder="예: SPRPG25C51, SPRPG25C52"
        />
        <input
          className="pipeline-token-input"
          value={adminToken}
          onChange={(event) => setAdminToken(event.target.value)}
          placeholder="관리자 토큰 (설정한 경우에만 입력)"
          type="password"
        />
        <button className="pipeline-button" type="button" onClick={handleRun} disabled={isSubmitting}>
          {isSubmitting ? "실행 중..." : "적재 실행"}
        </button>
      </div>

      {message ? (
        <p className={`pipeline-status${isError ? " pipeline-status-error" : ""}`}>{message}</p>
      ) : null}
    </div>
  );
}
