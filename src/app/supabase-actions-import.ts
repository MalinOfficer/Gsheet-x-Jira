
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
  created_at?: string;
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
      date: row.date,
      month: row.month,
      ticket_number: row.ticket_number,
      client_name: row.client_name,
      detail_module: row.detail_module,
      // Mapped fields
      check_in: row.created_at,
      check_out: row.resolved_at,
      pic_client: row.customer_name,
      status_case: row.status,
      category_case: row.ticket_category,
      module_case: row.module,
      detail_case: row.title,
      source_link_op: row.ticket_op,
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
