from __future__ import annotations

import csv
import json
import math
from pathlib import Path
from statistics import mean, pstdev


ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "sample_inventory.csv"
OUTPUT_DIR = ROOT / "output"
JSON_PATH = OUTPUT_DIR / "reorder_recommendations.json"
CSV_PATH = OUTPUT_DIR / "reorder_recommendations.csv"


def load_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def demand_series(row: dict[str, str]) -> list[float]:
    keys = [key for key in row if key.startswith("daily_demand_")]
    return [float(row[key]) for key in sorted(keys)]


def recommend(row: dict[str, str]) -> dict[str, object]:
    history = demand_series(row)
    avg_daily_demand = mean(history)
    demand_std = pstdev(history) if len(history) > 1 else 0.0

    on_hand = int(row["on_hand"])
    on_order = int(row["on_order"])
    lead_time_days = int(row["lead_time_days"])
    review_period_days = int(row["review_period_days"])
    service_level_z = float(row["service_level_z"])

    demand_during_lead_time = avg_daily_demand * lead_time_days
    safety_stock = service_level_z * demand_std * math.sqrt(lead_time_days)
    reorder_point = demand_during_lead_time + safety_stock
    target_stock = avg_daily_demand * (lead_time_days + review_period_days) + safety_stock
    inventory_position = on_hand + on_order
    reorder_qty = max(0, math.ceil(target_stock - inventory_position))
    days_of_cover = on_hand / avg_daily_demand if avg_daily_demand else 0.0

    urgency = "order_now" if inventory_position <= reorder_point else "monitor"

    return {
        "sku": row["sku"],
        "product_name": row["product_name"],
        "category": row["category"],
        "avg_daily_demand": round(avg_daily_demand, 2),
        "demand_std": round(demand_std, 2),
        "lead_time_days": lead_time_days,
        "review_period_days": review_period_days,
        "service_level_z": service_level_z,
        "on_hand": on_hand,
        "on_order": on_order,
        "inventory_position": inventory_position,
        "days_of_cover": round(days_of_cover, 1),
        "safety_stock": math.ceil(safety_stock),
        "reorder_point": math.ceil(reorder_point),
        "target_stock": math.ceil(target_stock),
        "recommended_reorder_qty": reorder_qty,
        "urgency": urgency,
    }


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = load_rows(DATA_PATH)
    recommendations = [recommend(row) for row in rows]
    recommendations.sort(
        key=lambda item: (item["urgency"] != "order_now", -int(item["recommended_reorder_qty"]))
    )

    summary = {
        "summary": {
            "sku_count": len(recommendations),
            "order_now_count": sum(1 for item in recommendations if item["urgency"] == "order_now"),
            "total_recommended_units": sum(int(item["recommended_reorder_qty"]) for item in recommendations),
        },
        "recommendations": recommendations,
    }

    with JSON_PATH.open("w", encoding="utf-8") as handle:
        json.dump(summary, handle, ensure_ascii=False, indent=2)

    with CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        fieldnames = list(recommendations[0].keys())
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(recommendations)

    print(f"Wrote {JSON_PATH}")
    print(f"Wrote {CSV_PATH}")


if __name__ == "__main__":
    main()
