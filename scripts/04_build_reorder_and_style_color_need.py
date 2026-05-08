import argparse

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


def get_color_code_from_sku(value):
    sku = str(value or "").strip()
    return sku[10:12] if len(sku) >= 12 else sku


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--styles", required=True, help="콤마 또는 줄바꿈으로 구분한 스타일코드")
    args = parser.parse_args()

    style_codes = parse_style_codes(args.styles)
    client = get_supabase_client()

    forecast_df = pd.DataFrame(fetch_all_rows(client, "sku_weekly_forecast"))
    stock_df = pd.DataFrame(fetch_all_rows(client, "center_stock"))

    forecast_df = forecast_df[forecast_df["style_code"].isin(style_codes)].copy()
    stock_df = stock_df[stock_df["style_code"].isin(style_codes)].copy()

    if forecast_df.empty or stock_df.empty:
        print("sku_weekly_forecast 또는 center_stock 데이터가 없습니다.")
        return

    forecast_df["week_no"] = pd.to_numeric(forecast_df["week_no"], errors="coerce")
    forecast_df["sale_qty"] = pd.to_numeric(forecast_df["sale_qty"], errors="coerce").fillna(0)
    forecast_df["loss"] = pd.to_numeric(forecast_df["loss"], errors="coerce").fillna(0)
    forecast_df["is_forecast"] = forecast_df["is_forecast"].fillna(False)

    stock_df["stock_qty"] = pd.to_numeric(stock_df["stock_qty"], errors="coerce").fillna(0)
    stock_df["ipgo_qty"] = pd.to_numeric(stock_df["ipgo_qty"], errors="coerce").fillna(0)

    need_payload = []
    reorder_payload = []

    color_need = (
        forecast_df[forecast_df["is_forecast"] == True]
        .assign(color_code=lambda df: df["sku"].apply(get_color_code_from_sku))
        .groupby(["style_code", "color_code", "year_week", "week_no"], as_index=False)["sale_qty"]
        .sum()
    )

    for _, row in color_need.iterrows():
        need_payload.append(
            {
                "style_code": row["style_code"],
                "color_code": row["color_code"],
                "year_week": row["year_week"],
                "week_no": safe_int(row["week_no"]),
                "need_qty": safe_float(row["sale_qty"]),
            }
        )

    grouped_stock = (
        stock_df.groupby(["style_code", "sku", "plant"], as_index=False)
        .agg(
            {
                "stock_qty": "sum",
                "ipgo_qty": "sum",
            }
        )
    )

    stock_map = {
        (row["style_code"], row["sku"], row["plant"]): row
        for _, row in grouped_stock.iterrows()
    }

    future_rows = forecast_df[forecast_df["is_forecast"] == True].copy()

    for (style_code, sku, plant), sku_future in future_rows.groupby(
        ["style_code", "sku", "plant"],
        dropna=False,
    ):
        sku_future = sku_future.sort_values("week_no")
        stock_info = stock_map.get((style_code, sku, plant))
        total_stock = safe_float(stock_info["stock_qty"] if stock_info is not None else 0)
        total_ipgo = safe_float(stock_info["ipgo_qty"] if stock_info is not None else 0)
        remaining_stock = total_stock + total_ipgo

        for _, row in sku_future.iterrows():
            sale_qty = safe_float(row["sale_qty"])
            shortage_qty = max(0, sale_qty - remaining_stock)
            recommended_order_qty = shortage_qty
            remaining_stock = max(0, remaining_stock - sale_qty)

            reorder_payload.append(
                {
                    "style_code": style_code,
                    "sku": sku,
                    "plant": plant,
                    "week_no": safe_int(row["week_no"]),
                    "year_week": row["year_week"],
                    "total_stock_qty": total_stock + total_ipgo,
                    "total_center_stock_qty": total_stock,
                    "total_store_stock_qty": 0,
                    "forecast_sale_qty": sale_qty,
                    "shortage_qty": shortage_qty,
                    "recommended_order_qty": recommended_order_qty,
                }
            )

    delete_style_codes(client, "style_color_weekly_need", style_codes)
    upsert_rows(client, "style_color_weekly_need", need_payload, on_conflict="style_code,color_code,week_no")

    delete_style_codes(client, "sku_reorder_plan", style_codes)
    upsert_rows(client, "sku_reorder_plan", reorder_payload, on_conflict="style_code,sku,plant,week_no")

    print(f"style_color_weekly_need 적재 완료: {len(need_payload)}건")
    print(f"sku_reorder_plan 적재 완료: {len(reorder_payload)}건")


if __name__ == "__main__":
    main()
