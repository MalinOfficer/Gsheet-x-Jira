
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

// New action to update just status
export async function updateCaseStatus(ticket_number: string, status: string) {
    try {
      const { error } = await supabaseAdmin
        .from('all_cases')
        .update({ status_case: status })
        .eq('ticket_number', ticket_number);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

/* ================= UPSERT is now importOrUpdateCases ================= */

export async function importOrUpdateCases(rows: ImportCasePayload[]) {
  try {
    if (!rows || rows.length === 0) {
      return { success: true, inserted: [], skipped: [], conflicts: [] };
    }
    
    const ticketNumbers = rows.map(r => r.ticket_number).filter(Boolean);

    // Handle rows without ticket numbers separately
    const rowsWithoutTickets = rows.filter(r => !r.ticket_number || r.ticket_number.trim() === '');
    const rowsWithTickets = rows.filter(r => r.ticket_number && r.ticket_number.trim() !== '');

    if (rowsWithTickets.length === 0) {
        return { 
            success: true, 
            inserted: [], 
            skipped: rowsWithoutTickets.map(r => ({ title: r.title || 'Unknown row', reason: 'Missing Ticket Number' })), 
            conflicts: [] 
        };
    }

    // Fetch existing cases that match the ticket numbers
    const { data: existingCases, error: fetchError } = await supabaseAdmin
        .from('all_cases')
        .select('ticket_number, status_case, detail_case')
        .in('ticket_number', ticketNumbers);

    if (fetchError) throw fetchError;

    const existingCasesMap = new Map<string, { status: string; title: string }>();
    existingCases.forEach(c => {
        if(c.ticket_number) {
            existingCasesMap.set(c.ticket_number, { status: c.status_case || '', title: c.detail_case || '' });
        }
    });

    const toInsert: any[] = [];
    const skippedDuplicates: any[] = [];
    const conflicts: any[] = [];

    rowsWithTickets.forEach((row) => {
        const existingCase = existingCasesMap.get(row.ticket_number);
        if (existingCase) {
            // It's a duplicate. Check for status conflict.
            if (existingCase.status.toLowerCase() !== row.status.toLowerCase()) {
                conflicts.push({
                    ticket_number: row.ticket_number,
                    title: existingCase.title,
                    old_status: existingCase.status,
                    new_status: row.status,
                });
            } else {
                // Status is the same, it's just a duplicate. Skip it.
                skippedDuplicates.push({ ticket_number: row.ticket_number, title: row.title, reason: 'Duplicate' });
            }
        } else {
            // It's a new case, add to insert list.
            toInsert.push({
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
              ticket_number: row.ticket_number,
            });
        }
    });
    
    let insertedData: any[] = [];
    if (toInsert.length > 0) {
        const { data, error } = await supabaseAdmin
            .from("all_cases")
            .insert(toInsert)
            .select('ticket_number, detail_case'); // Only select what's needed
        
        if (error) {
            if (error.message.includes('violates not-null constraint')) {
                const column = error.message.match(/column "(\w+)"/);
                throw new Error(`A required field is missing. Database requires a value for: ${column ? column[1] : 'a required column'}.`);
            }
            throw error;
        }
        insertedData = data || [];
    }

    return {
      success: true,
      inserted: insertedData.map(d => ({ ticket_number: d.ticket_number, title: d.detail_case })),
      skipped: [
          ...rowsWithoutTickets.map(r => ({ title: r.title || 'Unknown row', reason: 'Missing Ticket Number' })),
          ...skippedDuplicates
      ],
      conflicts: conflicts,
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
