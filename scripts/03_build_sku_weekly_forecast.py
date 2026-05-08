import argparse
from datetime import datetime

import pandas as pd

from common import (
    delete_style_codes,
    fetch_all_rows,
    get_supabase_client,
    parse_style_codes,
    safe_float,
    safe_int,
    upsert_rows,
)


MAX_WEEK = 52


def get_current_season_week():
    now = datetime.now()
    iso_year, iso_week, _ = now.isocalendar()
    return iso_year, iso_week


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--styles", required=True, help="콤마 또는 줄바꿈으로 구분한 스타일코드")
    args = parser.parse_args()

    style_codes = parse_style_codes(args.styles)
    client = get_supabase_client()
    current_year, current_week = get_current_season_week()

    actual_df = pd.DataFrame(fetch_all_rows(client, "raw_weekly_sales"))
    ratio_df = pd.DataFrame(fetch_all_rows(client, "style_ratio_weekly"))

    actual_df = actual_df[actual_df["style_code"].isin(style_codes)].copy()
    ratio_df = ratio_df[ratio_df["style_code"].isin(style_codes)].copy()

    if actual_df.empty or ratio_df.empty:
        print("raw_weekly_sales 또는 style_ratio_weekly 데이터가 없습니다.")
        return

    actual_df["week_no"] = pd.to_numeric(actual_df["week_no"], errors="coerce")
    actual_df["sale_qty"] = pd.to_numeric(actual_df["sale_qty"], errors="coerce").fillna(0)
    actual_df["ipgo_qty"] = pd.to_numeric(actual_df["ipgo_qty"], errors="coerce").fillna(0)
    actual_df["base_stock_qty"] = pd.to_numeric(actual_df["base_stock_qty"], errors="coerce").fillna(0)

    ratio_df["week_no"] = pd.to_numeric(ratio_df["week_no"], errors="coerce")
    ratio_df["last_year_ratio_pct"] = pd.to_numeric(
        ratio_df["last_year_ratio_pct"],
        errors="coerce",
    ).fillna(0)

    ratio_map = {
        (str(row["style_code"]).strip(), safe_int(row["week_no"])): row
        for _, row in ratio_df.iterrows()
    }

    payload = []

    for _, row in actual_df.iterrows():
        ratio = ratio_map.get((str(row["style_code"]).strip(), safe_int(row["week_no"])))
        payload.append(
            {
                "style_code": row["style_code"],
                "sku": row["sku"],
                "plant": row["plant"],
                "item_code": row["item_code"],
                "year_week": row["year_week"],
                "week_no": safe_int(row["week_no"]),
                "sale_qty": safe_float(row["sale_qty"]),
                "ipgo_qty": safe_float(row["ipgo_qty"]),
                "base_stock_qty": safe_float(row["base_stock_qty"]),
                "last_year_ratio_pct": safe_float(ratio["last_year_ratio_pct"] if ratio is not None else 0),
                "stage": ratio["stage"] if ratio is not None else None,
                "shape_type": ratio["shape_type"] if ratio is not None else None,
                "is_peak_week": safe_int(ratio["peak_week"] if ratio is not None else None)
                == safe_int(row["week_no"]),
                "is_forecast": False,
                "loss": 0,
                "sale_end_date": None,
            }
        )

    grouped = actual_df.groupby(["style_code", "sku", "plant", "item_code"], dropna=False)

    for (style_code, sku, plant, item_code), group in grouped:
        group = group[group["year_week"].astype(str).str.startswith(f"{current_year}-")].copy()
        if group.empty:
            continue

        group = group.sort_values("week_no")
        completed_actual = group[group["week_no"] < current_week].copy()
        if len(completed_actual.index) >= 2:
            reference_rows = completed_actual.tail(2).copy()
        elif len(completed_actual.index) == 1:
            reference_rows = completed_actual.tail(1).copy()
        else:
            reference_rows = group[group["week_no"] <= current_week].tail(2).copy()

        stock_reference = completed_actual.tail(1).copy()
        if stock_reference.empty:
            stock_reference = group.tail(1).copy()

        if reference_rows.empty or stock_reference.empty:
            continue

        weighted_reference = []
        reference_rows = reference_rows.sort_values("week_no")
        if len(reference_rows.index) >= 2:
            weighted_reference.append((reference_rows.iloc[-2], 0.3))
            weighted_reference.append((reference_rows.iloc[-1], 0.7))
        else:
            weighted_reference.append((reference_rows.iloc[-1], 1.0))

        reference_sale_base = sum(safe_float(row["sale_qty"]) * weight for row, weight in weighted_reference)
        reference_plc_base = 0
        for row, weight in weighted_reference:
            ratio = ratio_map.get((str(style_code).strip(), safe_int(row["week_no"])))
            reference_plc_base += safe_float(ratio["last_year_ratio_pct"] if ratio is not None else 0) * weight

        last_actual_week = safe_int(group["week_no"].max()) or 0
        prev_base_stock = safe_float(stock_reference.iloc[-1]["base_stock_qty"])

        for future_week in range(last_actual_week + 1, MAX_WEEK + 1):
            ratio = ratio_map.get((str(style_code).strip(), future_week))
            ratio_pct = safe_float(ratio["last_year_ratio_pct"] if ratio is not None else 0)
            raw_pred_sale = (
                reference_sale_base * (ratio_pct / reference_plc_base)
                if reference_plc_base > 0 and ratio_pct > 0
                else reference_sale_base
            )
            pred_sale = max(0, round(raw_pred_sale))
            loss = max(0, pred_sale - prev_base_stock)
            ending_base_stock = max(0, prev_base_stock - pred_sale)

            payload.append(
                {
                    "style_code": style_code,
                    "sku": sku,
                    "plant": plant,
                    "item_code": item_code,
                    "year_week": ratio["year_week"] if ratio is not None else f"{current_year}-W{future_week:02d}",
                    "week_no": future_week,
                    "sale_qty": pred_sale,
                    "ipgo_qty": 0,
                    "base_stock_qty": ending_base_stock,
                    "last_year_ratio_pct": ratio_pct,
                    "stage": ratio["stage"] if ratio is not None else None,
                    "shape_type": ratio["shape_type"] if ratio is not None else None,
                    "is_peak_week": safe_int(ratio["peak_week"] if ratio is not None else None) == future_week,
                    "is_forecast": True,
                    "loss": loss,
                    "sale_end_date": None,
                }
            )

            prev_base_stock = ending_base_stock

    delete_style_codes(client, "sku_weekly_forecast", style_codes)
    upsert_rows(client, "sku_weekly_forecast", payload, on_conflict="style_code,sku,plant,week_no")
    print(f"sku_weekly_forecast 적재 완료: {len(payload)}건")


if __name__ == "__main__":
    main()
