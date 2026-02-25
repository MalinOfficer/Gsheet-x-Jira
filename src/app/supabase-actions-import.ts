"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { normalizeClientName } from "@/lib/db-mapper";

// ============================================
// TYPES
// ============================================

export type ImportPayload = {
  date?: string;
  month?: string;
  created_at?: string;
  client_name: string;
  customer_name: string;
  status: string;
  ticket_number: string;
  ticket_category: string;
  module: string;
  detail_module: string;
  title: string;
  resolved_at?: string;
  ticket_op: string;
};

// ============================================
// PREVIEW IMPORT
// Cek duplikat sebelum melakukan insert, tanpa menyentuh DB
// ============================================

export async function previewImportCases(payload: {
  ticket_number: string;
  title?: string;
}[]): Promise<{
  success: boolean;
  newCount?: number;
  duplicates?: { ticket_number: string; title?: string }[];
  error?: string;
}> {
  try {
    const ticketNumbers = payload.map(p => p.ticket_number).filter(Boolean);
    if (!ticketNumbers.length) {
      return { success: true, newCount: 0, duplicates: [] };
    }

    const { data: existing, error } = await supabaseAdmin
      .from("all_cases")
      .select("ticket_number")
      .in("ticket_number", ticketNumbers)
      .is("deleted_at", null);

    if (error) throw new Error(error.message);

    const existingSet = new Set((existing || []).map((r: any) => r.ticket_number));

    const duplicates = payload.filter(p => existingSet.has(p.ticket_number));
    const newCount = payload.filter(p => !existingSet.has(p.ticket_number)).length;

    return { success: true, newCount, duplicates };
  } catch (err: any) {
    console.error("❌ Error previewing import:", err);
    return { success: false, error: err.message };
  }
}

// ============================================
// IMPORT OR UPDATE CASES
// Insert baru, skip duplikat exact, deteksi konflik status
// ============================================

export async function importOrUpdateCases(payload: ImportPayload[]): Promise<{
  success: boolean;
  error?: string;
  inserted?: { ticket_number: string; title: string }[];
  skipped?: { ticket_number: string; title: string }[];
  conflicts?: {
    ticket_number: string;
    title: string;
    old_status: string;
    new_status: string;
  }[];
}> {
  try {
    if (!payload || payload.length === 0) {
      return { success: false, error: "No data to import." };
    }

    const ticketNumbers = payload.map(p => p.ticket_number).filter(Boolean);
    if (ticketNumbers.length === 0) {
      return { success: false, error: "No valid ticket numbers found in payload." };
    }

    // Ambil semua tiket yang sudah ada di DB
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("all_cases")
      .select("ticket_number, status_case, detail_case")
      .in("ticket_number", ticketNumbers)
      .is("deleted_at", null);

    if (fetchError) throw new Error(fetchError.message);

    const existingMap = new Map(
      (existing || []).map((r: any) => [
        r.ticket_number,
        { status: r.status_case, title: r.detail_case },
      ])
    );

    const toInsert: Record<string, any>[] = [];
    const skipped: { ticket_number: string; title: string }[] = [];
    const conflicts: {
      ticket_number: string;
      title: string;
      old_status: string;
      new_status: string;
    }[] = [];

    for (const item of payload) {
      if (!item.ticket_number) continue;

      const existingItem = existingMap.get(item.ticket_number);

      if (existingItem) {
        // Tiket sudah ada — cek apakah status berbeda
        const isSameStatus =
          (existingItem.status || "").toLowerCase() ===
          (item.status || "").toLowerCase();

        if (!isSameStatus && item.status) {
          conflicts.push({
            ticket_number: item.ticket_number,
            title: item.title || existingItem.title || "",
            old_status: existingItem.status || "",
            new_status: item.status,
          });
        } else {
          skipped.push({
            ticket_number: item.ticket_number,
            title: item.title || existingItem.title || "",
          });
        }
        continue;
      }

      // Tiket baru — siapkan untuk insert
      toInsert.push({
        date: item.date || null,
        month: item.month || null,
        check_in: item.created_at || null,
        client_name: normalizeClientName(item.client_name || ""),
        pic_client: item.customer_name || null,
        status_case: item.status || "L1",
        ticket_number: item.ticket_number,
        category_case: item.ticket_category || null,
        module_case: item.module || null,
        detail_module: item.detail_module || null,
        detail_case: item.title || null,
        check_out: item.resolved_at || null,
        source_link_op: item.ticket_op || null,
      });
    }

    const inserted: { ticket_number: string; title: string }[] = [];

    // Batch insert dalam kelompok 500
    if (toInsert.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);

        const { data: insertedData, error: insertError } = await supabaseAdmin
          .from("all_cases")
          .insert(batch)
          .select("ticket_number, detail_case");

        if (insertError) throw new Error(insertError.message);

        (insertedData || []).forEach((r: any) => {
          inserted.push({
            ticket_number: r.ticket_number,
            title: r.detail_case || "",
          });
        });
      }
    }

    revalidatePath("/db");
    revalidatePath("/dashboard");

    return {
      success: true,
      inserted,
      skipped,
      conflicts,
    };
  } catch (err: any) {
    console.error("❌ importOrUpdateCases error:", err);
    return { success: false, error: err.message };
  }
}

// ============================================
// UPDATE CASE STATUS
// Digunakan untuk resolve konflik status satu per satu
// ============================================

export async function updateCaseStatus(
  ticketNumber: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!ticketNumber || !newStatus) {
      return { success: false, error: "Ticket number and new status are required." };
    }

    const { error } = await supabaseAdmin
      .from("all_cases")
      .update({ status_case: newStatus })
      .eq("ticket_number", ticketNumber)
      .is("deleted_at", null);

    if (error) throw new Error(error.message);

    revalidatePath("/db");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err: any) {
    console.error(`❌ updateCaseStatus error for ${ticketNumber}:`, err);
    return { success: false, error: err.message };
  }
}