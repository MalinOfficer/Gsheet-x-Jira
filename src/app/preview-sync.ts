"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { normalizeClientName } from "@/lib/db-mapper";

export interface PreviewRow {
  ticket_number: string;
  date: string | null;
  month: string | null;
  client_name: string | null;
  pic_client: string | null;
  status_case: string | null;
  category_case: string | null;
  module_case: string | null;
  detail_module: string | null;
  check_in: string | null;
  detail_case: string | null;
  detail_case_raw: string | null;
  note: string | null;
}

export interface PreviewUpdateRow {
  ticket_number: string;
  changes: {
    status_case?: { from: string | null; to: string };
    check_in?: { from: null; to: string };
    check_out?: { from: null; to: string };
  };
}

export interface PreviewResult {
  success: boolean;
  toInsert?: PreviewRow[];
  toUpdate?: PreviewUpdateRow[];   // ← baris yang perlu di-update
  skippedCount?: number;
  totalSheetRows?: number;
  headers?: string[];
  unmappedHeaders?: string[];
  error?: string;
}

// ─── Regex IHO-XXX ───────────────────────────────────────────────────────────
const TICKET_REGEX = /^(IHO-\d+)\s*(.*)/i;

function extractTicketFromDetail(raw: string | null): {
  ticketNumber: string | null;
  detailCase: string | null;
} {
  if (!raw?.trim()) return { ticketNumber: null, detailCase: null };
  const match = raw.trim().match(TICKET_REGEX);
  if (match) {
    return { ticketNumber: match[1].toUpperCase(), detailCase: match[2].trim() || null };
  }
  return { ticketNumber: null, detailCase: raw.trim() };
}

// ─── Column Map ───────────────────────────────────────────────────────────────
const _SYNC_COLUMN_MAP: Record<string, string> = {
  "no ticket": "ticket_number", "ticket number": "ticket_number",
  "ticket_number": "ticket_number", "no. ticket": "ticket_number",
  "tiket": "ticket_number", "no tiket": "ticket_number",
  "tanggal": "date", "date": "date",
  "bulan": "month", "month": "month",
  "client": "client_name", "client name": "client_name",
  "nama client": "client_name", "client_name": "client_name",
  "pic client": "pic_client", "pic": "pic_client", "pic_client": "pic_client",
  "customer name": "pic_client", "customer_name": "pic_client",
  "status": "status_case", "status case": "status_case", "status_case": "status_case",
  "kategori": "category_case", "category": "category_case",
  "category case": "category_case", "category_case": "category_case",
  "ticket category": "category_case", "ticket_category": "category_case",
  "modul": "module_case", "module": "module_case",
  "module case": "module_case", "module_case": "module_case",
  "detail modul": "detail_module", "detail module": "detail_module",
  "detail_module": "detail_module",
  "check in": "check_in", "check_in": "check_in", "masuk": "check_in",
  "created at": "check_in", "created_at": "check_in",
  "detail case": "detail_case", "detail_case": "detail_case",
  "judul": "detail_case", "title": "detail_case",
  "check out": "check_out", "check_out": "check_out", "selesai": "check_out",
  "resolved at": "check_out", "resolved_at": "check_out",
  "status solved": "status_case_solved", "status_case_solved": "status_case_solved",
  "link op": "source_link_op", "source link op": "source_link_op",
  "source_link_op": "source_link_op", "link": "source_link_op",
  "ticket op": "source_link_op", "ticket_op": "source_link_op",
  "catatan": "note", "note": "note", "notes": "note",
};

const _IGNORED_HEADERS = new Set([
  "no", "first response", "penanganan case", "pic l2",
  "progress l3", "status case 2", "durasi",
  "umur case/hari", "umur case",
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _extractSheetId(url: string): string | null {
  return url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? null;
}
function _extractGid(url: string): string | null {
  return url.match(/[?&#]gid=(\d+)/)?.[1] ?? null;
}
function _parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let inQuotes = false, field = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        row.push(field.trim()); field = '';
      } else { field += ch; }
    }
    row.push(field.trim());
    rows.push(row);
  }
  return rows;
}
function _normalizeSyncDate(raw: string): string | null {
  if (!raw?.trim()) return null;
  raw = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parts = raw.split('/');
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number);
    if (c > 1900) return `${c}-${String(b).padStart(2,'0')}-${String(a).padStart(2,'0')}`;
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function _normalizeSyncDatetime(rawTime: string | null, dateStr: string | null): string | null {
  if (!rawTime?.trim()) return null;
  const t = rawTime.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const d = new Date(t); return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (t.includes('/')) {
    const parts = t.split('/');
    if (parts.length === 3) {
      const [a, b, c] = parts.map(Number);
      if (c > 1900) {
        const d = new Date(`${c}-${String(b).padStart(2,'0')}-${String(a).padStart(2,'0')}`);
        return isNaN(d.getTime()) ? null : d.toISOString();
      }
    }
  }
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t) && dateStr) {
    const timePadded = t.length === 4 ? `0${t}` : t;
    const combined = new Date(`${dateStr}T${timePadded}:00`);
    return isNaN(combined.getTime()) ? null : combined.toISOString();
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export async function previewGSheetSync(sheetUrl: string): Promise<PreviewResult> {
  try {
    if (!sheetUrl?.includes('docs.google.com/spreadsheets')) {
      return { success: false, error: 'URL GSheet tidak valid.' };
    }

    const sheetId = _extractSheetId(sheetUrl);
    if (!sheetId) return { success: false, error: 'Tidak dapat mengekstrak Sheet ID.' };

    const gid = _extractGid(sheetUrl);
    const csvUrl = gid
      ? `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`
      : `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

    const response = await fetch(csvUrl, { cache: 'no-store' });
    if (!response.ok) {
      return { success: false, error: `Gagal fetch GSheet (HTTP ${response.status}).` };
    }

    const csvText = await response.text();
    const rows = _parseCsv(csvText);
    if (rows.length < 2) {
      return { success: true, toInsert: [], toUpdate: [], skippedCount: 0, totalSheetRows: 0 };
    }

    const rawHeaders = rows[0];
    const headers: (string | null)[] = rawHeaders.map(
      h => _SYNC_COLUMN_MAP[h.toLowerCase().trim()] ?? null
    );

    const unmappedHeaders = rawHeaders.filter(h => {
      const lower = h.toLowerCase().trim();
      return !_SYNC_COLUMN_MAP[lower] && !_IGNORED_HEADERS.has(lower);
    });

    const detailCaseColIdx = headers.indexOf('detail_case');
    const ticketColIdx     = headers.indexOf('ticket_number');

    if (detailCaseColIdx === -1 && ticketColIdx === -1) {
      return { success: false, unmappedHeaders, error: `Kolom "Detail Case" tidak ditemukan.` };
    }

    const dataRows = rows.slice(1);

    interface RawRecord {
      ticket_number: string;
      fields: Record<string, any>;
      detail_case_raw: string | null;
    }
    const rawRecords: RawRecord[] = [];

    for (const row of dataRows) {
      const detailCaseRaw = detailCaseColIdx !== -1 ? (row[detailCaseColIdx] || '').trim() || null : null;
      const { ticketNumber: ihoTicket, detailCase: cleanDetailCase } = extractTicketFromDetail(detailCaseRaw);
      const explicitTicket = ticketColIdx !== -1 ? (row[ticketColIdx] || '').trim() || null : null;
      const finalTicket = ihoTicket ?? explicitTicket;
      if (!finalTicket) continue;

      const fields: Record<string, any> = {};

      // Pass 1: semua kecuali check_in, check_out, detail_case
      headers.forEach((col, i) => {
        if (!col || col === 'detail_case' || col === 'check_in' || col === 'check_out') return;
        let val: string | null = (row[i] || '').trim() || null;
        if (col === 'date' && val) val = _normalizeSyncDate(val);
        if (col === 'client_name' && val) val = normalizeClientName(val);
        fields[col] = val;
      });

      // Pass 2: check_in & check_out — gabungkan dengan date
      const dateStr = fields['date'] as string | null;
      headers.forEach((col, i) => {
        if (col !== 'check_in' && col !== 'check_out') return;
        fields[col] = _normalizeSyncDatetime((row[i] || '').trim() || null, dateStr);
      });

      fields['ticket_number'] = finalTicket;
      fields['detail_case']   = cleanDetailCase;

      rawRecords.push({ ticket_number: finalTicket, fields, detail_case_raw: detailCaseRaw });
    }

    if (!rawRecords.length) {
      return { success: true, toInsert: [], toUpdate: [], skippedCount: 0, totalSheetRows: 0 };
    }

    const allTickets = rawRecords.map(r => r.ticket_number);

    // Fetch existing: ambil status_case, check_in, check_out untuk deteksi update
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('all_cases')
      .select('ticket_number, status_case, check_in, check_out')
      .in('ticket_number', allTickets)
      .is('deleted_at', null);

    if (fetchErr) return { success: false, error: `DB error: ${fetchErr.message}` };

    const existingMap = new Map<string, { status_case: string | null; check_in: string | null; check_out: string | null }>(
      (existing || []).map((r: any) => [r.ticket_number, {
        status_case: r.status_case,
        check_in: r.check_in,
        check_out: r.check_out,
      }])
    );

    // ── Baris baru (INSERT) ───────────────────────────────────────────────
    const toInsert: PreviewRow[] = rawRecords
      .filter(r => !existingMap.has(r.ticket_number))
      .map(r => ({
        ticket_number:   r.fields.ticket_number,
        date:            r.fields.date ?? null,
        month:           r.fields.month ?? null,
        client_name:     r.fields.client_name ?? null,
        pic_client:      r.fields.pic_client ?? null,
        status_case:     r.fields.status_case ?? null,
        category_case:   r.fields.category_case ?? null,
        module_case:     r.fields.module_case ?? null,
        detail_module:   r.fields.detail_module ?? null,
        check_in:        r.fields.check_in ?? null,
        detail_case:     r.fields.detail_case ?? null,
        detail_case_raw: r.detail_case_raw,
        note:            r.fields.note ?? null,
      }));

    // ── Baris yang perlu di-UPDATE ─────────────────────────────────────────
    const toUpdate: PreviewUpdateRow[] = [];

    for (const r of rawRecords) {
      const db = existingMap.get(r.ticket_number);
      if (!db) continue; // baris baru, bukan update

      const changes: PreviewUpdateRow['changes'] = {};

      // Status berubah?
      if (r.fields.status_case &&
          (db.status_case || '').trim().toLowerCase() !== (r.fields.status_case || '').trim().toLowerCase()) {
        changes.status_case = { from: db.status_case, to: r.fields.status_case };
      }
      // check_in kosong di DB, ada di GSheet?
      if (!db.check_in && r.fields.check_in) {
        changes.check_in = { from: null, to: r.fields.check_in };
      }
      // check_out kosong di DB, ada di GSheet?
      if (!db.check_out && r.fields.check_out) {
        changes.check_out = { from: null, to: r.fields.check_out };
      }

      if (Object.keys(changes).length > 0) {
        toUpdate.push({ ticket_number: r.ticket_number, changes });
      }
    }

    const skippedCount = existingMap.size - toUpdate.length;

    return {
      success: true,
      toInsert,
      toUpdate,
      skippedCount,
      totalSheetRows: allTickets.length,
      headers: rawHeaders,
      unmappedHeaders,
    };

  } catch (err: any) {
    return { success: false, error: err.message || 'Terjadi kesalahan tak terduga.' };
  }
}