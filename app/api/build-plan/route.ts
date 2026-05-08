import { runForecastPipeline } from "@/lib/pipeline";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 300;

type BuildPlanRequest = {
  styles?: string | string[];
  adminToken?: string;
};

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return Response.json(
      { error: "Supabase 환경변수가 없습니다." },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as BuildPlanRequest;
  const styles = body.styles ?? "";
  const expectedToken = process.env.PIPELINE_TRIGGER_TOKEN?.trim();
  const providedToken = body.adminToken?.trim() ?? "";

  if (expectedToken && providedToken !== expectedToken) {
    return Response.json(
      { error: "관리 토큰이 올바르지 않습니다." },
      { status: 401 },
    );
  }

  try {
    const summary = await runForecastPipeline(supabase, styles);

    return Response.json({
      ok: true,
      summary,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "적재 실행에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
