
"use server";

import { supabaseAdmin } from "@/lib/supabase";

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
    // 1. De-duplicate the source data, keeping the last occurrence.
    const seenTickets = new Set<string>();
    const uniqueRows: ImportCasePayload[] = [];
    const sourceDuplicates: ImportCasePayload[] = [];
    
    // Iterate backwards to keep the last one
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      if (row.ticket_number && seenTickets.has(row.ticket_number)) {
        sourceDuplicates.push(row);
      } else if (row.ticket_number) {
        uniqueRows.unshift(row); // add to the beginning to maintain original order
        seenTickets.add(row.ticket_number);
      }
    }
    
    if (uniqueRows.length === 0) {
      return {
        success: true,
        imported: [],
        updated: [],
        duplicates: sourceDuplicates.map(r => ({ ticket_number: r.ticket_number, title: r.title })),
      };
    }

    const uniqueTicketNumbers = uniqueRows.map(r => r.ticket_number);

    // 2. Find which tickets already exist in the database
    const { data: existingCases, error: fetchError } = await supabaseAdmin
      .from("all_cases")
      .select("ticket_number")
      .in("ticket_number", uniqueTicketNumbers);

    if (fetchError) {
      throw new Error(`Failed to check existing cases: ${fetchError.message}`);
    }

    const existingTicketNumbers = new Set(existingCases.map(c => c.ticket_number));

    const newCases: ImportCasePayload[] = [];
    const updatedCases: ImportCasePayload[] = [];

    uniqueRows.forEach(row => {
      if (existingTicketNumbers.has(row.ticket_number)) {
        updatedCases.push(row);
      } else {
        newCases.push(row);
      }
    });

    // 3. Prepare payload for upsert
    const payload = uniqueRows.map((row) => ({
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

    // 4. Perform the upsert. This is now safe because `payload` has no duplicate ticket_numbers.
    const { error: upsertError } = await supabaseAdmin
      .from("all_cases")
      .upsert(payload, {
        onConflict: "ticket_number",
      });

    if (upsertError) throw upsertError;

    // 5. Return detailed results
    return {
      success: true,
      imported: newCases.map(r => ({ ticket_number: r.ticket_number, title: r.title })),
      updated: updatedCases.map(r => ({ ticket_number: r.ticket_number, title: r.title })),
      duplicates: sourceDuplicates.map(r => ({ ticket_number: r.ticket_number, title: r.title })),
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
