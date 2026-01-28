
"use server";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ================= TYPES ================= */

export type ImportCasePayload = {
  date: string;
  month: string;
  ticket_number: string;
  client_name: string;
  customer_name?: string;
  status: string;
  ticket_category: string;
  module: string;
  detail_module?: string;
  title?: string;
  resolved_at?: string;
  ticket_op?: string;
  url_jira?: string;
  status_case_2?: string;
  duration?: number;
  pic_client?: string;
  checkout?: string;
};

/* ================= UPSERT ================= */

export async function importOrUpdateCases(rows: ImportCasePayload[]) {
  try {
    const payload = rows.map((row) => ({
      ...row,
      check_in: row.resolved_at ? new Date(row.resolved_at).toISOString() : null, // Assuming created_at maps to check_in
      detail_case: row.title,
      // Map other frontend fields to DB fields if names differ
      module_case: row.module,
      category_case: row.ticket_category,
      status_case: row.status,
      source_link_op: row.ticket_op,
      pic_client: row.customer_name,
      check_out: row.resolved_at,
      // updated_at will be handled by Supabase (or trigger)
    }));

    const { error } = await supabase
      .from("all_cases")
      .upsert(payload, {
        onConflict: "ticket_number",
      });

    if (error) throw error;

    return { success: true, count: payload.length };
  } catch (err: any) {
    return { error: err.message };
  }
}

/* ================= DELETE ALL ================= */

export async function truncateAllCases() {
  try {
    const { error } = await supabase.rpc("truncate_all_cases");
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
