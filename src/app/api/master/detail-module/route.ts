import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─────────────────────────────────────────────────────────────────────────────
// GET — Ambil semua data master_detail_module
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from("master_detail_module")
            .select("id_module, detail_module")
            .order("id_module", { ascending: true });

        if (error) throw error;

        console.log(`📦 [Detail Module GET] ${(data ?? []).length} records`);
        return NextResponse.json({ data: data ?? [] });
    } catch (err: any) {
        console.error("❌ [Detail Module GET] Error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}