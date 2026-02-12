import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { searchNCM } from "@/lib/ncm-search";

// ---------------------------------------------------------------------------
// POST /api/ncm/search
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { query, limit = 10, threshold = 0.5 } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "query es requerido" },
        { status: 400 }
      );
    }

    const result = await searchNCM(supabase, query, { limit, threshold });
    return NextResponse.json(result);
  } catch (error) {
    console.error("NCM search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/ncm/search?q=...&limit=5
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const limit = parseInt(searchParams.get("limit") || "10");

  if (!query) {
    return NextResponse.json({ error: "q es requerido" }, { status: 400 });
  }

  const result = await searchNCM(supabase, query, { limit });
  return NextResponse.json(result);
}
