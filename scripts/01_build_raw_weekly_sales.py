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


RAW_FILE_SELECT = "CALDAY,PLANT,SKU,STYLE_CODE,SALE_QTY,IPGO_QTY,STOCK_CHANGE_QTY"


def calday_to_year_week(calday_value):
    text = str(calday_value or "").replace(".0", "").strip()
    dt = pd.to_datetime(text, format="%Y%m%d", errors="coerce")

    if pd.isna(dt):
        return None, None

    iso = dt.isocalendar()
    return f"{int(iso.year)}-W{int(iso.week):02d}", int(iso.week)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--styles", required=True, help="콤마 또는 줄바꿈으로 구분한 스타일코드")
    args = parser.parse_args()

    style_codes = parse_style_codes(args.styles)
    client = get_supabase_client()
    rows = fetch_all_rows(client, "raw_file", RAW_FILE_SELECT)
    df = pd.DataFrame(rows)

    if df.empty:
        print("raw_file 데이터가 없습니다.")
        return

    df = df[df["STYLE_CODE"].isin(style_codes)].copy()
    if df.empty:
        print("선택한 스타일코드 데이터가 없습니다.")
        return

    df[["year_week", "week_no"]] = df["CALDAY"].apply(lambda value: pd.Series(calday_to_year_week(value)))
    df = df.dropna(subset=["year_week", "STYLE_CODE", "SKU", "PLANT"])

    for column in ["SALE_QTY", "IPGO_QTY", "STOCK_CHANGE_QTY"]:
        df[column] = pd.to_numeric(df[column], errors="coerce").fillna(0)

    weekly = (
        df.groupby(["STYLE_CODE", "SKU", "PLANT", "year_week", "week_no"], dropna=False, as_index=False)
        .agg(
            {
                "SALE_QTY": "sum",
                "IPGO_QTY": "sum",
                "STOCK_CHANGE_QTY": "sum",
            }
        )
        .sort_values(["STYLE_CODE", "SKU", "PLANT", "week_no"])
    )

    weekly["base_stock_qty"] = (
        weekly.groupby(["STYLE_CODE", "SKU", "PLANT"])["IPGO_QTY"].cumsum()
        - weekly.groupby(["STYLE_CODE", "SKU", "PLANT"])["SALE_QTY"].cumsum()
    )

    payload = []
    for _, row in weekly.iterrows():
        style_code = str(row["STYLE_CODE"]).strip()
        payload.append(
            {
                "style_code": style_code,
                "sku": str(row["SKU"]).strip(),
                "plant": str(row["PLANT"]).strip(),
                "item_code": style_code[2:4] if len(style_code) >= 4 else None,
                "year_week": row["year_week"],
                "week_no": safe_int(row["week_no"]),
                "sale_qty": safe_float(row["SALE_QTY"]),
                "ipgo_qty": safe_float(row["IPGO_QTY"]),
                "stock_change_qty": safe_float(row["STOCK_CHANGE_QTY"]),
                "base_stock_qty": max(0, safe_float(row["base_stock_qty"])),
            }
        )

    delete_style_codes(client, "raw_weekly_sales", style_codes)
    upsert_rows(client, "raw_weekly_sales", payload, on_conflict="style_code,sku,plant,year_week")
    print(f"raw_weekly_sales 적재 완료: {len(payload)}건")


if __name__ == "__main__":
    main()
