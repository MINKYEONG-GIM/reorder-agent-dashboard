from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "similar_item_sales.csv"
OUTPUT_DIR = ROOT / "output"
JSON_PATH = OUTPUT_DIR / "similar_item_forecast.json"
CSV_PATH = OUTPUT_DIR / "similar_item_forecast.csv"


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def load_rows() -> list[dict[str, str]]:
    with DATA_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def score_row(row: dict[str, str]) -> dict[str, object]:
    last_year_units = float(row["last_year_units"])
    last_year_revenue = float(row["last_year_revenue"])
    last_year_discount = float(row["last_year_discount_rate"])
    this_year_discount = float(row["this_year_discount_rate"])
    price_ratio = float(row["price_ratio"])
    trend_score = float(row["trend_score"])
    similarity_score = float(row["similarity_score"])

    revenue_per_unit = last_year_revenue / max(last_year_units, 1)
    discount_delta = this_year_discount - last_year_discount
    discount_lift = 1 + (discount_delta * 1.8)
    trend_lift = 1 + trend_score
    price_lift = clamp(1.05 - ((price_ratio - 1.0) * 0.9), 0.82, 1.18)
    similarity_weight = clamp(similarity_score, 0.50, 1.00)

    predicted_units = last_year_units * discount_lift * trend_lift * price_lift * similarity_weight

    return {
        "target_item": row["target_item"],
        "similar_item": row["similar_item"],
        "last_year_units": round(last_year_units),
        "revenue_per_unit": round(revenue_per_unit, 0),
        "discount_delta_pct": round(discount_delta * 100, 1),
        "similarity_score": similarity_weight,
        "predicted_units_from_this_reference": round(predicted_units),
    }


def aggregate(scored_rows: list[dict[str, object]]) -> list[dict[str, object]]:
    grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in scored_rows:
        grouped[str(row["target_item"])].append(row)

    forecasts: list[dict[str, object]] = []
    for target_item, rows in grouped.items():
        weighted_sum = 0.0
        weight_total = 0.0
        reference_units = 0.0

        for row in rows:
            weight = float(row["similarity_score"])
            predicted_units = float(row["predicted_units_from_this_reference"])
            weighted_sum += predicted_units * weight
            weight_total += weight
            reference_units += float(row["last_year_units"])

        forecast_units = round(weighted_sum / weight_total) if weight_total else 0
        avg_reference_units = round(reference_units / max(len(rows), 1))

        forecasts.append(
            {
                "target_item": target_item,
                "reference_count": len(rows),
                "avg_reference_units": avg_reference_units,
                "predicted_units_this_year": forecast_units,
                "top_reference": max(rows, key=lambda item: float(item["similarity_score"]))["similar_item"],
            }
        )

    forecasts.sort(key=lambda row: int(row["predicted_units_this_year"]), reverse=True)
    return forecasts


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    scored_rows = [score_row(row) for row in load_rows()]
    forecasts = aggregate(scored_rows)

    payload = {
      "summary": {
          "target_item_count": len(forecasts),
          "reference_row_count": len(scored_rows),
          "total_predicted_units": sum(int(row["predicted_units_this_year"]) for row in forecasts),
      },
      "forecasts": forecasts,
      "references": scored_rows,
      "example_prompt": (
          "작년 유사 아이템의 판매량, 할인율, 판매액 데이터를 바탕으로 "
          "올해 신상품의 판매량을 예측하는 Python 봇을 만들어줘."
      ),
    }

    with JSON_PATH.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)

    with CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        fieldnames = list(forecasts[0].keys())
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(forecasts)

    print(f"Wrote {JSON_PATH}")
    print(f"Wrote {CSV_PATH}")


if __name__ == "__main__":
    main()
