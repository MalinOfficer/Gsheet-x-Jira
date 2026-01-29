
"use server";

import { supabaseAdmin } from "@/lib/supabase";

/* ================= TYPES ================= */

export type ImportCasePayload = {
  date: string;
  month: string;
  created_at?: string;
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
    if (!rows || rows.length === 0) {
      return { success: true, imported: [], updated: [], duplicates: [] };
    }
    
    // Prepare payload for insert. 
    const payload = rows.map((row) => ({
      date: row.date,
      month: row.month,
      client_name: row.client_name,
      detail_module: row.detail_module,
      check_in: row.created_at,
      check_out: row.resolved_at,
      pic_client: row.customer_name,
      status_case: row.status,
      category_case: row.ticket_category,
      module_case: row.module,
      detail_case: row.title,
      source_link_op: row.ticket_op,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("all_cases")
      .insert(payload);

    if (insertError) throw insertError;

    // Since it's a pure insert, all are "imported".
    return {
      success: true,
      imported: rows.map(r => ({ title: r.title })),
      updated: [],
      duplicates: [],
    };
  } catch (err: any) {
    console.error("Error in importOrUpdateCases:", err);
    return { error: err.message };
  }
}

/* ================= DELETE ALL ================= */

export async function truncateAllCases() {
  try {
    const { error } = await supabaseAdmin.rpc("truncate_all_cases");
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
