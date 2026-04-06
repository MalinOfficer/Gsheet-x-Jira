// app/api/dashboard/cases/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
    try {
        const sp = req.nextUrl.searchParams;

        const years         = sp.get("years")?.split(",").filter(Boolean)         ?? [];
        const categories    = sp.get("categories")?.split(",").filter(Boolean)    ?? [];
        const clients       = sp.get("clients")?.split(",").filter(Boolean)       ?? [];
        const modules       = sp.get("modules")?.split(",").filter(Boolean)       ?? [];
        const detailModules = sp.get("detailModules")?.split(",").filter(Boolean) ?? [];
        const statuses      = sp.get("statuses")?.split(",").filter(Boolean)      ?? [];
        const search        = sp.get("search")?.trim() ?? "";
        const dateFrom      = sp.get("dateFrom");
        const dateTo        = sp.get("dateTo");

        const BATCH = 1000;
        let allCases: any[] = [];
        let from = 0;

        while (true) {
            let q = supabaseAdmin
                .from("all_cases")
                .select(
                    "id, date, client_name, ticket_number, detail_case, status_case, " +
                    "category_case, module_case, detail_module, check_in, check_out"
                )
                .is("deleted_at", null)
                .range(from, from + BATCH - 1)
                .order("date", { ascending: false });

            // ── Date filters ──────────────────────────────────────────────
            if (dateFrom) {
                const df = dateFrom.split("T")[0];
                q = q.gte("date", df);
            } else if (years.length === 1) {
                const y = parseInt(years[0], 10);
                if (!isNaN(y)) q = q.gte("date", `${y}-01-01`).lte("date", `${y}-12-31`);
            } else if (years.length > 1) {
                const orParts = years
                    .map((y) => {
                        const n = parseInt(y, 10);
                        return isNaN(n) ? null : `and(date.gte.${n}-01-01,date.lte.${n}-12-31)`;
                    })
                    .filter(Boolean)
                    .join(",");
                if (orParts) q = q.or(orParts);
            }

            if (dateTo) {
                const dt = dateTo.split("T")[0];
                q = q.lte("date", dt);
            }

            // ── Categorical filters ───────────────────────────────────────
            if (categories.length    > 0) q = q.in("category_case", categories);
            if (clients.length       > 0) q = q.in("client_name",   clients);
            if (modules.length       > 0) q = q.in("module_case",   modules);
            if (detailModules.length > 0) q = q.in("detail_module", detailModules);

            // ── Status filter ─────────────────────────────────────────────
            if (statuses.length > 0) {
                const statusVariants = statuses.flatMap((s) => [
                    s,
                    s.toUpperCase(),
                    s.charAt(0).toUpperCase() + s.slice(1),
                ]);
                q = q.in("status_case", [...new Set(statusVariants)]);
            }

            const { data: batch, error } = await q;

            if (error) {
                console.error("[GET /api/dashboard/cases] Supabase error:", error.message);
                throw new Error(error.message);
            }

            if (!batch || batch.length === 0) break;

            allCases = allCases.concat(batch);
            if (batch.length < BATCH) break;
            from += BATCH;
        }

        // ── Search di memori ──────────────────────────────────────────────
        if (search) {
            const q = search.toLowerCase();
            allCases = allCases.filter(
                (c) =>
                    (c.ticket_number ?? "").toLowerCase().includes(q) ||
                    (c.detail_case   ?? "").toLowerCase().includes(q) ||
                    (c.client_name   ?? "").toLowerCase().includes(q)
            );
        }

        // ── Map: ticket_number + detail_case digabung jadi title ──────────
        const cases = allCases.map((r) => {
            const ticketNo   = String(r.ticket_number ?? "").trim();
            const detailCase = String(r.detail_case   ?? "").trim();

            return {
                ticket_no:     ticketNo   || undefined,
                client_name:   String(r.client_name   ?? "").trim(),
                title:         detailCase || undefined,
                status:        String(r.status_case   ?? "").trim(),
                category:      String(r.category_case ?? "").trim() || undefined,
                module:        String(r.module_case   ?? "").trim() || undefined,
                detail_module: String(r.detail_module ?? "").trim() || undefined,
                created_at:    r.check_in  ?? undefined,
                resolved_at:   r.check_out ?? undefined,
                pic:           undefined,
            };
        });

        console.log(`[GET /api/dashboard/cases] Returning ${cases.length} cases`);

        return NextResponse.json({ cases, total: cases.length });

    } catch (err: any) {
        console.error("[GET /api/dashboard/cases]", err);
        return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
    }
}