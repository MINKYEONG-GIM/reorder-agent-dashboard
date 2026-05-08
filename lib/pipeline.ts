import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseAdmin = SupabaseClient<any, "public", any>;

type RawFileRow = {
  CALDAY: string | number | null;
  PLANT: string | null;
  SKU: string | null;
  STYLE_CODE: string | null;
  SALE_QTY: number | string | null;
  IPGO_QTY: number | string | null;
  STOCK_CHANGE_QTY: number | string | null;
  ITEM_CODE: string | null;
};

type RawWeeklySalesRow = {
  style_code: string;
  sku: string;
  plant: string;
  item_code: string | null;
  year_week: string;
  week_no: number;
  sale_qty: number;
  ipgo_qty: number;
  stock_change_qty: number;
  base_stock_qty: number;
};

type ItemPlcRow = {
  item_code: string | null;
  year_week: string | null;
  week_no: number | string | null;
  last_year_ratio_pct: number | string | null;
  stage: string | null;
  shape_type: string | null;
  peak_week: number | string | null;
};

type StyleRatioWeeklyRow = {
  style_code: string;
  ref_item_code: string;
  year_week: string;
  week_no: number;
  last_year_ratio_pct: number;
  stage: string | null;
  shape_type: string | null;
  peak_week: number | null;
  ratio_source: "matched" | "average_fallback";
};

type SkuWeeklyForecastRow = {
  style_code: string;
  sku: string;
  plant: string;
  item_code: string | null;
  year_week: string;
  week_no: number;
  sale_qty: number;
  ipgo_qty: number;
  base_stock_qty: number;
  last_year_ratio_pct: number;
  stage: string | null;
  shape_type: string | null;
  is_peak_week: boolean;
  is_forecast: boolean;
  loss: number;
  sale_end_date: string | null;
};

type SkuWeeklyForecastInsertRow = {
  style_code: string;
  sku: string;
  plant: string;
  item_code: string | null;
  year_week: string;
  week_no: number;
  sale_qty: number;
  IPGO_QTY: number;
  BASE_STOCK_QTY: number;
  last_year_ratio_pct: number;
  stage: string | null;
  shape_type: string | null;
  is_peak_week: boolean;
  is_forecast: boolean;
  loss: number;
  sale_end_date: string | null;
};

type CenterStockRow = {
  style_code: string | null;
  sku: string | null;
  plant: string | null;
  stock_qty: number | string | null;
  ipgo_qty: number | string | null;
};

type StyleColorNeedRow = {
  style_code: string;
  color_code: string;
  year_week: string;
  week_no: number;
  need_qty: number;
};

type SkuReorderPlanRow = {
  style_code: string;
  sku: string;
  plant: string;
  week_no: number;
  year_week: string;
  total_stock_qty: number;
  total_center_stock_qty: number;
  total_store_stock_qty: number;
  forecast_sale_qty: number;
  shortage_qty: number;
  recommended_order_qty: number;
};

export type PipelineRunSummary = {
  styles: string[];
  batchSize: number;
  totalBatches: number;
  rawWeeklySalesCount: number;
  styleRatioWeeklyCount: number;
  skuWeeklyForecastCount: number;
  styleColorWeeklyNeedCount: number;
  skuReorderPlanCount: number;
};

const PAGE_SIZE = 1000;
const UPSERT_BATCH_SIZE = 500;
const MAX_WEEK = 52;
const DASHBOARD_TIME_ZONE = "Asia/Seoul";

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function getPipelineBatchSize() {
  const rawValue = Number(process.env.PIPELINE_STYLE_BATCH_SIZE ?? 5);
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 5;
  }
  return Math.max(1, Math.floor(rawValue));
}

function parseStyleCodes(raw: string | string[]) {
  const text = Array.isArray(raw) ? raw.join(",") : raw;
  return [...new Set(text.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean))];
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function toInt(value: unknown) {
  return Math.round(toNumber(value));
}

function getStyleRefItemCode(styleCode: string) {
  return styleCode.length >= 4 ? styleCode.slice(2, 4) : styleCode;
}

function getColorCodeFromSku(sku: string) {
  return sku.length >= 12 ? sku.slice(10, 12) : sku;
}

function parseCalday(value: unknown) {
  const text = String(value ?? "").replace(".0", "").trim();
  if (!/^\d{8}$/.test(text)) {
    return null;
  }

  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(4, 6)) - 1;
  const day = Number(text.slice(6, 8));
  const date = new Date(Date.UTC(year, month, day));

  return Number.isNaN(date.getTime()) ? null : date;
}

function getIsoWeekInfo(date: Date) {
  const copy = new Date(date.getTime());
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);

  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((copy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return {
    isoYear: copy.getUTCFullYear(),
    isoWeek: weekNo,
  };
}

function buildYearWeek(isoYear: number, isoWeek: number) {
  return `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
}

function getYearFromYearWeek(yearWeek: string | null | undefined) {
  const matched = String(yearWeek ?? "").match(/^(\d{4})/);
  return matched ? Number(matched[1]) : null;
}

function getCurrentSeasonWeek() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");

  return getIsoWeekInfo(new Date(Date.UTC(year, month - 1, day)));
}

async function ensureForecastTableSchema(supabase: SupabaseAdmin) {
  const selectColumns = [
    "style_code",
    "sku",
    "plant",
    "item_code",
    "year_week",
    "week_no",
    "sale_qty",
    "ipgo_qty:IPGO_QTY",
    "base_stock_qty:BASE_STOCK_QTY",
    "last_year_ratio_pct",
    "stage",
    "shape_type",
    "is_peak_week",
    "is_forecast",
    "loss",
    "sale_end_date",
  ].join(",");

  const { error } = await supabase.from("sku_weekly_forecast").select(selectColumns).limit(1);

  if (error) {
    throw new Error(
      `sku_weekly_forecast 테이블 구조 확인 실패: ${error.message}. 현재 forecast 테이블 컬럼 구성이 코드 기대값과 같은지 확인해 주세요.`,
    );
  }
}

async function fetchAllRows<T>(
  supabase: SupabaseAdmin,
  table: string,
  select: string,
  apply?: (query: any) => any,
) {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    let query: any = supabase.from(table).select(select);
    if (apply) {
      query = apply(query);
    }

    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`${table} 조회 실패: ${error.message}`);
    }

    const page = data ?? [];
    if (!page.length) {
      break;
    }

    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return rows;
}

async function deleteByStyleCodes(supabase: SupabaseAdmin, table: string, styleCodes: string[]) {
  for (const styles of chunk(styleCodes, 100)) {
    const { error } = await supabase.from(table).delete().in("style_code", styles);
    if (error) {
      throw new Error(`${table} 삭제 실패: ${error.message}`);
    }
  }
}

async function upsertRows<T extends Record<string, unknown>>(
  supabase: SupabaseAdmin,
  table: string,
  rows: T[],
  onConflict: string,
) {
  for (const batch of chunk(rows, UPSERT_BATCH_SIZE)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      throw new Error(`${table} 적재 실패: ${error.message}`);
    }
  }
}

async function buildRawWeeklySales(supabase: SupabaseAdmin, styleCodes: string[]) {
  const rawRows = await fetchAllRows<RawFileRow>(
    supabase,
    "raw_file",
    "CALDAY,PLANT,SKU,STYLE_CODE,SALE_QTY,IPGO_QTY,STOCK_CHANGE_QTY,ITEM_CODE",
    (query) => query.in("STYLE_CODE", styleCodes),
  );

  const aggregate = new Map<string, RawWeeklySalesRow>();

  for (const row of rawRows) {
    const styleCode = String(row.STYLE_CODE ?? "").trim();
    const sku = String(row.SKU ?? "").trim();
    const plant = String(row.PLANT ?? "").trim();
    const calday = parseCalday(row.CALDAY);

    if (!styleCode || !sku || !plant || !calday) {
      continue;
    }

    const { isoYear, isoWeek } = getIsoWeekInfo(calday);
    const yearWeek = buildYearWeek(isoYear, isoWeek);
    const key = `${styleCode}__${sku}__${plant}__${yearWeek}`;
    const current =
      aggregate.get(key) ?? {
        style_code: styleCode,
        sku,
        plant,
        item_code: String(row.ITEM_CODE ?? "").trim() || getStyleRefItemCode(styleCode),
        year_week: yearWeek,
        week_no: isoWeek,
        sale_qty: 0,
        ipgo_qty: 0,
        stock_change_qty: 0,
        base_stock_qty: 0,
      };

    current.sale_qty += toNumber(row.SALE_QTY);
    current.ipgo_qty += toNumber(row.IPGO_QTY);
    current.stock_change_qty += toNumber(row.STOCK_CHANGE_QTY);

    aggregate.set(key, current);
  }

  const rows = [...aggregate.values()].sort((a, b) => {
    if (a.style_code !== b.style_code) return a.style_code.localeCompare(b.style_code);
    if (a.sku !== b.sku) return a.sku.localeCompare(b.sku);
    if (a.plant !== b.plant) return a.plant.localeCompare(b.plant);
    return a.week_no - b.week_no;
  });

  const runningStock = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.style_code}__${row.sku}__${row.plant}`;
    const previous = runningStock.get(key) ?? 0;
    const next = previous + row.ipgo_qty - row.sale_qty;
    row.base_stock_qty = Math.max(0, next);
    runningStock.set(key, row.base_stock_qty);
  }

  await deleteByStyleCodes(supabase, "raw_weekly_sales", styleCodes);
  await upsertRows(supabase, "raw_weekly_sales", rows, "style_code,sku,plant,year_week");

  return rows;
}

async function buildStyleRatioWeekly(
  supabase: SupabaseAdmin,
  styleCodes: string[],
  rawWeeklySales: RawWeeklySalesRow[],
) {
  const { isoYear: currentYear } = getCurrentSeasonWeek();
  const averageItemCode = "평균";
  const refCodes = [...new Set(styleCodes.map(getStyleRefItemCode).filter(Boolean))];
  const plcRows: ItemPlcRow[] = [];

  for (const codes of chunk([...refCodes, averageItemCode], 100)) {
    const rows = await fetchAllRows<ItemPlcRow>(
      supabase,
      "item_plc",
      "item_code,year_week,week_no,last_year_ratio_pct,stage,shape_type,peak_week",
      (query) => query.in("item_code", codes),
    );
    plcRows.push(...rows);
  }

  const plcMap = new Map<string, ItemPlcRow>();
  const weekNumbers = new Set<number>();

  for (const row of plcRows) {
    const itemCode = String(row.item_code ?? "").trim();
    const yearWeek = String(row.year_week ?? "").trim();
    const weekNo = toInt(row.week_no);

    if (!itemCode || !yearWeek || weekNo <= 0) {
      continue;
    }

    const key = `${itemCode}__${weekNo}`;
    const current = plcMap.get(key);
    if (!current || yearWeek > String(current.year_week ?? "")) {
      plcMap.set(key, row);
    }

    weekNumbers.add(weekNo);
  }

  const rows: StyleRatioWeeklyRow[] = [];
  const sortedWeeks = [...weekNumbers].sort((a, b) => a - b);

  for (const styleCode of styleCodes) {
    const refItemCode = getStyleRefItemCode(styleCode);

    for (const weekNo of sortedWeeks) {
      const matched = plcMap.get(`${refItemCode}__${weekNo}`);
      const fallback = plcMap.get(`${averageItemCode}__${weekNo}`);
      const resolved = matched ?? fallback;

      rows.push({
        style_code: styleCode,
        ref_item_code: refItemCode,
        year_week: buildYearWeek(currentYear, weekNo),
        week_no: weekNo,
        last_year_ratio_pct: toNumber(resolved?.last_year_ratio_pct),
        stage: resolved?.stage ?? null,
        shape_type: resolved?.shape_type ?? null,
        peak_week: resolved ? toInt(resolved.peak_week) : null,
        ratio_source: matched ? "matched" : "average_fallback",
      });
    }
  }

  await deleteByStyleCodes(supabase, "style_ratio_weekly", styleCodes);
  await upsertRows(supabase, "style_ratio_weekly", rows, "style_code,year_week");

  return rows;
}

async function buildSkuWeeklyForecast(
  supabase: SupabaseAdmin,
  styleCodes: string[],
  rawWeeklySales: RawWeeklySalesRow[],
  styleRatios: StyleRatioWeeklyRow[],
) {
  const { isoYear: currentYear, isoWeek: currentWeek } = getCurrentSeasonWeek();
  const ratioMap = new Map<string, StyleRatioWeeklyRow>();
  const ratioWeeksByStyle = new Map<string, StyleRatioWeeklyRow[]>();

  for (const row of styleRatios) {
    if (getYearFromYearWeek(row.year_week) !== currentYear) {
      continue;
    }

    ratioMap.set(`${row.style_code}__${row.week_no}`, row);
    const current = ratioWeeksByStyle.get(row.style_code) ?? [];
    current.push(row);
    ratioWeeksByStyle.set(row.style_code, current);
  }

  const rows: SkuWeeklyForecastRow[] = rawWeeklySales.map((row) => {
    const ratio = ratioMap.get(`${row.style_code}__${row.week_no}`);

    return {
      style_code: row.style_code,
      sku: row.sku,
      plant: row.plant,
      item_code: row.item_code,
      year_week: row.year_week,
      week_no: row.week_no,
      sale_qty: row.sale_qty,
      ipgo_qty: row.ipgo_qty,
      base_stock_qty: row.base_stock_qty,
      last_year_ratio_pct: toNumber(ratio?.last_year_ratio_pct),
      stage: ratio?.stage ?? null,
      shape_type: ratio?.shape_type ?? null,
      is_peak_week: toInt(ratio?.peak_week) === row.week_no,
      is_forecast: false,
      loss: 0,
      sale_end_date: null,
    };
  });

  const actualGroups = new Map<string, RawWeeklySalesRow[]>();
  for (const row of rawWeeklySales) {
    const key = `${row.style_code}__${row.sku}__${row.plant}`;
    const current = actualGroups.get(key) ?? [];
    current.push(row);
    actualGroups.set(key, current);
  }

  for (const [key, group] of actualGroups.entries()) {
    const currentSeasonActuals = [...group]
      .filter((row) => getYearFromYearWeek(row.year_week) === currentYear)
      .sort((a, b) => a.week_no - b.week_no);
    const completedActuals = currentSeasonActuals.filter((row) => row.week_no < currentWeek);
    const referenceActuals =
      completedActuals.length >= 2
        ? completedActuals.slice(-2)
        : completedActuals.length === 1
          ? completedActuals
          : currentSeasonActuals.filter((row) => row.week_no <= currentWeek).slice(-2);
    const stockReferenceActual = completedActuals.at(-1) ?? currentSeasonActuals.at(-1);

    if (!stockReferenceActual || referenceActuals.length === 0) {
      continue;
    }

    const [styleCode, sku, plant] = key.split("__");
    let previousBaseStock = toNumber(stockReferenceActual.base_stock_qty);
    const weightedReferenceRows =
      referenceActuals.length >= 2
        ? [
            { row: referenceActuals[referenceActuals.length - 2], weight: 0.3 },
            { row: referenceActuals[referenceActuals.length - 1], weight: 0.7 },
          ]
        : [{ row: referenceActuals[0], weight: 1 }];
    const referenceSaleBase = weightedReferenceRows.reduce(
      (sum, entry) => sum + toNumber(entry.row.sale_qty) * entry.weight,
      0,
    );
    const referencePlcBase = weightedReferenceRows.reduce((sum, entry) => {
      const ratio = ratioMap.get(`${styleCode}__${entry.row.week_no}`);
      return sum + toNumber(ratio?.last_year_ratio_pct) * entry.weight;
    }, 0);
    const futureWeeks = [...(ratioWeeksByStyle.get(styleCode) ?? [])]
      .sort((a, b) => a.week_no - b.week_no)
      .filter((row) => row.week_no > currentWeek);

    const fallbackWeeks =
      futureWeeks.length > 0
        ? futureWeeks
        : Array.from({ length: MAX_WEEK - currentWeek }, (_, index) => {
            const weekNo = currentWeek + index + 1;
            return {
              style_code: styleCode,
              ref_item_code: getStyleRefItemCode(styleCode),
              year_week: buildYearWeek(currentYear, weekNo),
              week_no: weekNo,
              last_year_ratio_pct: 0,
              stage: null,
              shape_type: null,
              peak_week: null,
              ratio_source: "average_fallback" as const,
            };
          });

    for (const week of fallbackWeeks) {
      const ratioPct = toNumber(week.last_year_ratio_pct);
      const rawPredictedSale =
        referencePlcBase > 0 && ratioPct > 0
          ? referenceSaleBase * (ratioPct / referencePlcBase)
          : referenceSaleBase;
      const predictedSale = toInt(rawPredictedSale);
      const loss = Math.max(0, predictedSale - previousBaseStock);
      const endingBaseStock = Math.max(0, previousBaseStock - predictedSale);

      rows.push({
        style_code: styleCode,
        sku,
        plant,
        item_code: stockReferenceActual.item_code,
        year_week: week.year_week,
        week_no: week.week_no,
        sale_qty: predictedSale,
        ipgo_qty: 0,
        base_stock_qty: endingBaseStock,
        last_year_ratio_pct: ratioPct,
        stage: week.stage,
        shape_type: week.shape_type,
        is_peak_week: toInt(week.peak_week) === week.week_no,
        is_forecast: true,
        loss,
        sale_end_date: null,
      });

      previousBaseStock = endingBaseStock;
    }
  }

  rows.sort((a, b) => {
    if (a.style_code !== b.style_code) return a.style_code.localeCompare(b.style_code);
    if (a.sku !== b.sku) return a.sku.localeCompare(b.sku);
    if (a.plant !== b.plant) return a.plant.localeCompare(b.plant);
    return a.week_no - b.week_no;
  });

  await deleteByStyleCodes(supabase, "sku_weekly_forecast", styleCodes);
  const insertRows: SkuWeeklyForecastInsertRow[] = rows.map((row) => ({
    style_code: row.style_code,
    sku: row.sku,
    plant: row.plant,
    item_code: row.item_code,
    year_week: row.year_week,
    week_no: row.week_no,
    sale_qty: row.sale_qty,
    IPGO_QTY: row.ipgo_qty,
    BASE_STOCK_QTY: row.base_stock_qty,
    last_year_ratio_pct: row.last_year_ratio_pct,
    stage: row.stage,
    shape_type: row.shape_type,
    is_peak_week: row.is_peak_week,
    is_forecast: row.is_forecast,
    loss: row.loss,
    sale_end_date: row.sale_end_date,
  }));
  await upsertRows(supabase, "sku_weekly_forecast", insertRows, "style_code,sku,plant,week_no");

  return rows;
}

async function buildReorderPlan(
  supabase: SupabaseAdmin,
  styleCodes: string[],
  forecastRows: SkuWeeklyForecastRow[],
) {
  const { isoYear: currentYear, isoWeek: currentWeek } = getCurrentSeasonWeek();
  const stockRows = await fetchAllRows<CenterStockRow>(
    supabase,
    "center_stock",
    "style_code,sku,plant,stock_qty,ipgo_qty",
    (query) => query.in("style_code", styleCodes),
  );

  const groupedStock = new Map<
    string,
    {
      totalStockQty: number;
      totalIpgoQty: number;
    }
  >();

  for (const row of stockRows) {
    const styleCode = String(row.style_code ?? "").trim();
    const sku = String(row.sku ?? "").trim();
    const plant = String(row.plant ?? "").trim();

    if (!styleCode || !sku || !plant) {
      continue;
    }

    const key = `${styleCode}__${sku}__${plant}`;
    const current =
      groupedStock.get(key) ?? {
        totalStockQty: 0,
        totalIpgoQty: 0,
      };

    current.totalStockQty += toNumber(row.stock_qty);
    current.totalIpgoQty += toNumber(row.ipgo_qty);
    groupedStock.set(key, current);
  }

  const displayRows = forecastRows.filter((row) => {
    const rowYear = getYearFromYearWeek(row.year_week);
    if (rowYear !== currentYear) {
      return false;
    }

    if (row.week_no === currentWeek) {
      return !row.is_forecast;
    }

    return row.is_forecast && row.week_no > currentWeek;
  });

  const styleColorNeedMap = new Map<string, StyleColorNeedRow>();
  const reorderPlanRows: SkuReorderPlanRow[] = [];
  const forecastBySkuPlant = new Map<string, SkuWeeklyForecastRow[]>();

  for (const row of displayRows) {
    const key = `${row.style_code}__${row.sku}__${row.plant}`;
    const current = forecastBySkuPlant.get(key) ?? [];
    current.push(row);
    forecastBySkuPlant.set(key, current);

    const colorCode = getColorCodeFromSku(row.sku);
    const colorKey = `${row.style_code}__${colorCode}__${row.week_no}`;
    const colorCurrent =
      styleColorNeedMap.get(colorKey) ?? {
        style_code: row.style_code,
        color_code: colorCode,
        year_week: row.year_week,
        week_no: row.week_no,
        need_qty: 0,
      };
    colorCurrent.need_qty += toNumber(row.sale_qty);
    styleColorNeedMap.set(colorKey, colorCurrent);
  }

  for (const [key, rows] of forecastBySkuPlant.entries()) {
    const [styleCode, sku, plant] = key.split("__");
    const stock = groupedStock.get(key) ?? { totalStockQty: 0, totalIpgoQty: 0 };
    let remainingStock = stock.totalStockQty + stock.totalIpgoQty;

    for (const row of [...rows].sort((a, b) => a.week_no - b.week_no)) {
      const forecastSaleQty = toNumber(row.sale_qty);
      const shortageQty = Math.max(0, forecastSaleQty - remainingStock);
      const recommendedOrderQty = shortageQty;
      remainingStock = Math.max(0, remainingStock - forecastSaleQty);

      reorderPlanRows.push({
        style_code: styleCode,
        sku,
        plant,
        week_no: row.week_no,
        year_week: row.year_week,
        total_stock_qty: stock.totalStockQty + stock.totalIpgoQty,
        total_center_stock_qty: stock.totalStockQty,
        total_store_stock_qty: 0,
        forecast_sale_qty: forecastSaleQty,
        shortage_qty: shortageQty,
        recommended_order_qty: recommendedOrderQty,
      });
    }
  }

  const styleColorNeedRows = [...styleColorNeedMap.values()].sort((a, b) => {
    if (a.style_code !== b.style_code) return a.style_code.localeCompare(b.style_code);
    if (a.color_code !== b.color_code) return a.color_code.localeCompare(b.color_code);
    return a.week_no - b.week_no;
  });

  await deleteByStyleCodes(supabase, "style_color_weekly_need", styleCodes);
  await upsertRows(supabase, "style_color_weekly_need", styleColorNeedRows, "style_code,color_code,week_no");

  await deleteByStyleCodes(supabase, "sku_reorder_plan", styleCodes);
  await upsertRows(supabase, "sku_reorder_plan", reorderPlanRows, "style_code,sku,plant,week_no");

  return {
    styleColorNeedRows,
    reorderPlanRows,
  };
}

export async function runForecastPipeline(supabase: SupabaseAdmin, rawStyles: string | string[]) {
  const styleCodes = parseStyleCodes(rawStyles);
  if (!styleCodes.length) {
    throw new Error("스타일코드를 1개 이상 입력해 주세요.");
  }

  await ensureForecastTableSchema(supabase);

  const batchSize = getPipelineBatchSize();
  const styleBatches = chunk(styleCodes, batchSize);
  let rawWeeklySalesCount = 0;
  let styleRatioWeeklyCount = 0;
  let skuWeeklyForecastCount = 0;
  let styleColorWeeklyNeedCount = 0;
  let skuReorderPlanCount = 0;

  for (const batchStyles of styleBatches) {
    const rawWeeklySales = await buildRawWeeklySales(supabase, batchStyles);
    const styleRatios = await buildStyleRatioWeekly(supabase, batchStyles, rawWeeklySales);
    const forecastRows = await buildSkuWeeklyForecast(supabase, batchStyles, rawWeeklySales, styleRatios);
    const { styleColorNeedRows, reorderPlanRows } = await buildReorderPlan(supabase, batchStyles, forecastRows);

    rawWeeklySalesCount += rawWeeklySales.length;
    styleRatioWeeklyCount += styleRatios.length;
    skuWeeklyForecastCount += forecastRows.length;
    styleColorWeeklyNeedCount += styleColorNeedRows.length;
    skuReorderPlanCount += reorderPlanRows.length;
  }

  return {
    styles: styleCodes,
    batchSize,
    totalBatches: styleBatches.length,
    rawWeeklySalesCount,
    styleRatioWeeklyCount,
    skuWeeklyForecastCount,
    styleColorWeeklyNeedCount,
    skuReorderPlanCount,
  } satisfies PipelineRunSummary;
}
