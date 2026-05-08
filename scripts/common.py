import math
import os
from typing import Iterable

from supabase import Client, create_client


def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.getenv("SUPABASE_KEY", "").strip()
    )

    if not url or not key:
        raise ValueError("SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.")

    return create_client(url, key)


def fetch_all_rows(client: Client, table_name: str, select_sql: str = "*", page_size: int = 1000):
    rows = []
    offset = 0

    while True:
        response = (
            client.table(table_name)
            .select(select_sql)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        data = response.data or []

        if not data:
            break

        rows.extend(data)

        if len(data) < page_size:
            break

        offset += page_size

    return rows


def chunked(rows: list, size: int):
    for index in range(0, len(rows), size):
        yield rows[index:index + size]


def upsert_rows(
    client: Client,
    table_name: str,
    rows: list[dict],
    on_conflict: str,
    batch_size: int = 500,
):
    for batch in chunked(rows, batch_size):
        client.table(table_name).upsert(batch, on_conflict=on_conflict).execute()


def delete_style_codes(client: Client, table_name: str, style_codes: Iterable[str]):
    style_codes = [style_code for style_code in style_codes if style_code]
    if not style_codes:
        return

    client.table(table_name).delete().in_("style_code", style_codes).execute()


def safe_float(value, default: float = 0.0) -> float:
    try:
        if value is None or (isinstance(value, float) and math.isnan(value)):
            return default
        return float(value)
    except Exception:
        return default


def safe_int(value, default: int | None = 0) -> int | None:
    try:
        if value is None:
            return default
        return int(round(float(value)))
    except Exception:
        return default


def parse_style_codes(raw: str) -> list[str]:
    items = []
    for token in raw.replace("\n", ",").split(","):
        value = token.strip()
        if value:
            items.append(value)
    return list(dict.fromkeys(items))
