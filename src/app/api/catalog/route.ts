import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

/**
 * GET /api/catalog?search=...&provider_id=...&client_id=...&page=1&limit=50
 *
 * Lista y busca productos en el catálogo.
 * Soporta búsqueda por texto (SKU, descripción, NCM) y filtro por proveedor.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search")?.trim() || "";
  const providerId = searchParams.get("provider_id") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") || "50"));
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from("product_catalog")
      .select("*, provider:providers(id, name)", { count: "exact" });

    // Filtro por proveedor
    if (providerId) {
      query = query.eq("provider_id", providerId);
    }

    const clientId = searchParams.get("client_id") || "";

    if (clientId) {
      // Find provider_ids from invoices linked to this client's despachos
      const { data: clientInvoices } = await supabase
        .from("invoices")
        .select("provider_id, despacho:despachos!inner(client_id)")
        .eq("despacho.client_id", clientId)
        .not("provider_id", "is", null);

      const providerIds = [...new Set(
        (clientInvoices || [])
          .map((inv: Record<string, unknown>) => inv.provider_id as string)
          .filter(Boolean)
      )];

      if (providerIds.length > 0) {
        query = query.in("provider_id", providerIds);
      } else {
        return NextResponse.json({ items: [], total: 0, page, limit, totalPages: 0 });
      }
    }

    // Búsqueda por texto en múltiples campos
    if (search) {
      query = query.or(
        `sku.ilike.%${search}%,provider_description.ilike.%${search}%,customs_description.ilike.%${search}%,internal_description.ilike.%${search}%,ncm_code.ilike.%${search}%`
      );
    }

    // Ordenar por más usados primero, luego por última vez usado
    query = query
      .order("times_used", { ascending: false })
      .order("last_used_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      items: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error("Catalog search error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/catalog
 * Crea un nuevo producto en el catálogo.
 * Body: { provider_id, sku, provider_description, customs_description?, ncm_code?, ... }
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!body.provider_id) {
      return NextResponse.json({ error: "Proveedor es obligatorio" }, { status: 400 });
    }
    if (!body.sku || !body.sku.trim()) {
      return NextResponse.json({ error: "SKU es obligatorio" }, { status: 400 });
    }

    // Validar NCM contra nomenclator si se proporcionó
    if (body.ncm_code?.trim()) {
      const { data: ncmMatch } = await supabase
        .from("ncm_nomenclator")
        .select("id")
        .eq("ncm_code", body.ncm_code.trim())
        .limit(1);

      if (!ncmMatch || ncmMatch.length === 0) {
        return NextResponse.json(
          { error: `El código NCM "${body.ncm_code.trim()}" no existe en el nomenclador` },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from("product_catalog")
      .insert({
        provider_id: body.provider_id,
        sku: body.sku.trim(),
        provider_description: body.provider_description?.trim() || "",
        customs_description: body.customs_description?.trim() || "",
        internal_description: body.internal_description?.trim() || null,
        ncm_code: body.ncm_code?.trim() || "",
        latu: body.latu ?? null,
        imesi: body.imesi ?? null,
        exonera_iva: body.exonera_iva ?? null,
        apertura: body.apertura ?? null,
        times_used: 0,
        last_used_at: new Date().toISOString(),
      })
      .select("*, provider:providers(id, name)")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe un producto con ese SKU para este proveedor" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Catalog create error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/catalog
 * Actualiza un producto del catálogo.
 * Body: { id, customs_description, ncm_code }
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id, ...updates } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // Solo permitir actualizar ciertos campos
    const allowedUpdates: Record<string, unknown> = {};
    if (updates.customs_description !== undefined)
      allowedUpdates.customs_description = updates.customs_description;
    if (updates.ncm_code !== undefined)
      allowedUpdates.ncm_code = updates.ncm_code;
    if (updates.sku !== undefined) allowedUpdates.sku = updates.sku;
    if (updates.latu !== undefined) allowedUpdates.latu = updates.latu;
    if (updates.imesi !== undefined) allowedUpdates.imesi = updates.imesi;
    if (updates.exonera_iva !== undefined)
      allowedUpdates.exonera_iva = updates.exonera_iva;
    if (updates.apertura !== undefined)
      allowedUpdates.apertura = updates.apertura;
    if (updates.internal_description !== undefined)
      allowedUpdates.internal_description = updates.internal_description;
    if (updates.provider_id !== undefined)
      allowedUpdates.provider_id = updates.provider_id;

    console.log("[Catalog PATCH] id:", id, "updates:", allowedUpdates);

    const { data, error } = await supabase
      .from("product_catalog")
      .update(allowedUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Catalog PATCH] Error:", error);
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe un producto con ese SKU para el proveedor destino" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("[Catalog PATCH] Success, updated row:", data?.id);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Catalog update error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/catalog?id=...
 * Elimina un producto del catálogo.
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from("product_catalog")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Catalog delete error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
