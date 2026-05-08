import { getDashboardPageData } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? undefined;
  const page = searchParams.get("page") ?? undefined;
  const pageData = await getDashboardPageData(query, page);
  return Response.json(pageData);
}
