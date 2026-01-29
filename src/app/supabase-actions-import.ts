
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
  ticket_number: string; // Re-added ticket_number
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
      return { success: true, processed: [], skipped: [] };
    }
    
    // Separate rows with and without a ticket number
    const toProcess: any[] = [];
    const skipped: any[] = [];

    rows.forEach((row) => {
      if (row.ticket_number && row.ticket_number.trim() !== '') {
        toProcess.push({
          // Map to DB columns
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
          ticket_number: row.ticket_number, // Ensure this is passed
        });
      } else {
        skipped.push({ title: row.title || 'Unknown row' });
      }
    });

    if (toProcess.length === 0) {
        return { success: true, processed: [], skipped };
    }

    // Use upsert to insert new rows or update existing ones based on ticket_number
    const { data, error } = await supabaseAdmin
      .from("all_cases")
      .upsert(toProcess, { onConflict: 'ticket_number' })
      .select();

    if (error) {
      // Check for specific constraint violations to give a better message
      if (error.message.includes('violates not-null constraint')) {
        const column = error.message.match(/column "(\w+)"/);
        throw new Error(`A required field is missing. Database requires a value for: ${column ? column[1] : 'a required column'}.`);
      }
      throw error;
    }

    return {
      success: true,
      processed: data?.map(d => ({ ticket_number: d.ticket_number, title: d.detail_case })) || [],
      skipped,
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
