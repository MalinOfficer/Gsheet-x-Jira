import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// ✅ GET handler - ambil rincian kendala berdasarkan id_module
// app/api/master/rincian-kendala/route.ts
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id_module = searchParams.get("id_module");

        // Jika ada id_module → return single (existing behavior)
        if (id_module) {
            if (isNaN(Number(id_module))) {
                return NextResponse.json(
                    { error: "id_module harus berupa angka." },
                    { status: 400 }
                );
            }
            const { data, error } = await supabaseAdmin
                .from("master_rincian_kendala")
                .select("*")
                .eq("id_module", Number(id_module))
                .maybeSingle();
            if (error) throw error;
            return NextResponse.json({ data });
        }

        // Tanpa id_module → return SEMUA records sebagai array
        const { data, error } = await supabaseAdmin
            .from("master_rincian_kendala")
            .select("*")
            .order("id_module", { ascending: true });

        if (error) throw error;

        console.log(`✅ [Rincian Kendala GET ALL] ${data?.length ?? 0} records`);
        return NextResponse.json({ data: data ?? [] });
    } catch (err: any) {
        console.error("❌ [Rincian Kendala GET] Error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ✅ POST handler - insert atau update rincian kendala
export async function POST(req: NextRequest) {
    try {
        let body: any;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json(
                { error: "Body request bukan JSON valid atau kosong." },
                { status: 400 }
            );
        }

        const { id_module, rincian_kendala } = body;

        if (!id_module || typeof id_module !== "number") {
            return NextResponse.json(
                { error: "id_module wajib diisi dan harus berupa angka." },
                { status: 400 }
            );
        }

        if (!rincian_kendala?.trim()) {
            return NextResponse.json(
                { error: "rincian_kendala wajib diisi." },
                { status: 400 }
            );
        }

        // Cek apakah record sudah ada
        const { data: existing } = await supabaseAdmin
            .from("master_rincian_kendala")
            .select("id")
            .eq("id_module", id_module)
            .maybeSingle();

        let data, error;

        if (existing?.id) {
            // UPDATE
            ({ data, error } = await supabaseAdmin
                .from("master_rincian_kendala")
                .update({
                    rincian_kendala: rincian_kendala.trim(),
                    updated_at: new Date().toISOString(),
                })
                .eq("id_module", id_module)
                .select()
                .single());
        } else {
            // INSERT
            ({ data, error } = await supabaseAdmin
                .from("master_rincian_kendala")
                .insert({
                    id_module,
                    rincian_kendala: rincian_kendala.trim(),
                })
                .select()
                .single());
        }

        if (error) throw error;

        console.log(`✅ [Rincian Kendala POST] ${existing?.id ? "Updated" : "Inserted"} id_module=${id_module}`);
        return NextResponse.json({ data });
    } catch (err: any) {
        console.error("❌ [Rincian Kendala POST] Error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}