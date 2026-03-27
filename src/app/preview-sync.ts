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
  // Flat display fields (nilai terbaru dari GSheet, fallback ke DB)
  date: string | null;
  client_name: string | null;
  status_case: string | null;
  category_case: string | null;
  module_case: string | null;
  detail_module: string | null;
  detail_case: string | null;
  // Diff detail — hanya field yang benar-benar berubah
  changes: {
    status_case?:    { from: string | null; to: string };
    check_in?:       { from: null; to: string };
    check_out?:      { from: null; to: string };
    client_name?:    { from: string | null; to: string };
    module_case?:    { from: string | null; to: string };
    detail_module?:  { from: string | null; to: string };
    category_case?:  { from: string | null; to: string };
    pic_client?:     { from: string | null; to: string };
    detail_case?:    { from: string | null; to: string };
    source_link_op?: { from: string | null; to: string };
    note?:           { from: string | null; to: string };
    month?:          { from: string | null; to: string };
  };
  // Summary label untuk ditampilkan di UI (misal: "Status, Modul")
  changedFields: string[];
}

export interface PreviewResult {
  success: boolean;
  toInsert?: PreviewRow[];
  toUpdate?: PreviewUpdateRow[];
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
  // Ticket Number
  "no ticket": "ticket_number", "ticket number": "ticket_number",
  "ticket_number": "ticket_number", "no. ticket": "ticket_number",
  "tiket": "ticket_number", "no tiket": "ticket_number",
  "nomor tiket": "ticket_number", "no. tiket": "ticket_number",

  // Date
  "tanggal": "date", "date": "date", "tgl": "date",

  // Month
  "bulan": "month", "month": "month",

  // Client
  "client": "client_name", "client name": "client_name",
  "nama client": "client_name", "client_name": "client_name",
  "nama klien": "client_name", "klien": "client_name",
  "customer": "client_name",

  // PIC Client
  "pic client": "pic_client", "pic": "pic_client", "pic_client": "pic_client",
  "customer name": "pic_client", "customer_name": "pic_client",
  "nama customer": "pic_client", "nama pic": "pic_client",

  // Status
  "status": "status_case", "status case": "status_case", "status_case": "status_case",
  "status tiket": "status_case",

  // Category
  "kategori": "category_case", "category": "category_case",
  "category case": "category_case", "category_case": "category_case",
  "ticket category": "category_case", "ticket_category": "category_case",
  "kategori tiket": "category_case", "jenis": "category_case",
  "jenis tiket": "category_case", "tipe": "category_case",
  "tipe tiket": "category_case",

  // Module
  "modul": "module_case", "module": "module_case",
  "module case": "module_case", "module_case": "module_case",
  "nama modul": "module_case", "nama module": "module_case",

  // Detail Module
  "detail modul": "detail_module", "detail module": "detail_module",
  "detail_module": "detail_module", "modul detail": "detail_module",
  "sub modul": "detail_module", "sub module": "detail_module",
  "sub-modul": "detail_module",

  // Check In / Created At
  "check in": "check_in", "check_in": "check_in", "masuk": "check_in",
  "created at": "check_in", "created_at": "check_in",
  "tgl masuk": "check_in", "tanggal masuk": "check_in",
  "waktu masuk": "check_in",

  // Detail Case / Title
  "detail case": "detail_case", "detail_case": "detail_case",
  "judul": "detail_case", "title": "detail_case",
  "deskripsi": "detail_case", "description": "detail_case",
  "detail": "detail_case",

  // Check Out / Resolved At
  "check out": "check_out", "check_out": "check_out", "selesai": "check_out",
  "resolved at": "check_out", "resolved_at": "check_out",
  "tgl selesai": "check_out", "tanggal selesai": "check_out",
  "waktu selesai": "check_out",

  // Status Solved
  "status solved": "status_case_solved", "status_case_solved": "status_case_solved",

  // Source Link / Ticket OP
  "link op": "source_link_op", "source link op": "source_link_op",
  "source_link_op": "source_link_op", "link": "source_link_op",
  "ticket op": "source_link_op", "ticket_op": "source_link_op",
  "url": "source_link_op", "url jira": "source_link_op",
  "jira": "source_link_op", "link tiket": "source_link_op",

  // Note
  "catatan": "note", "note": "note", "notes": "note",
  "keterangan": "note", "remarks": "note",
};

const _IGNORED_HEADERS = new Set([
  "no", "first response", "penanganan case", "pic l2",
  "progress l3", "status case 2", "durasi",
  "umur case/hari", "umur case",
]);

// ─── Human-readable field labels ─────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  status_case:    "Status",
  client_name:    "Client",
  module_case:    "Modul",
  detail_module:  "Detail Modul",
  category_case:  "Kategori",
  pic_client:     "PIC",
  detail_case:    "Detail Case",
  source_link_op: "Link OP",
  note:           "Note",
  month:          "Bulan",
  check_in:       "Check In",
  check_out:      "Check Out",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _extractSheetId(url: string): string | null {
  return url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? null;
}
function _extractGid(url: string): string | null {
  return url.match(/[?&#]gid=(\d+)/)?.[1] ?? null;
}

/**
 * Parser CSV yang benar untuk multi-line fields.
 */
function _parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch   = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field.trim());
        field = '';
      } else if (ch === '\r') {
        if (next === '\n') i++;
        row.push(field.trim());
        field = '';
        if (row.some(f => f !== '')) rows.push(row);
        row = [];
      } else if (ch === '\n') {
        row.push(field.trim());
        field = '';
        if (row.some(f => f !== '')) rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field.trim());
    if (row.some(f => f !== '')) rows.push(row);
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

/**
 * Semua perbandingan string case-insensitive dan trim.
 * Jika fromSheet kosong, tidak dianggap beda (GSheet tidak update field ini).
 */
function _isDifferent(
  fromDB: string | null | undefined,
  fromSheet: string | null | undefined,
  caseInsensitive = true
): boolean {
  const a = (fromDB    || '').trim();
  const b = (fromSheet || '').trim();
  // Kalau GSheet tidak ada nilainya, skip — jangan overwrite DB dengan kosong
  if (!b) return false;
  return caseInsensitive
    ? a.toLowerCase() !== b.toLowerCase()
    : a !== b;
}

/**
 * Bandingkan dua datetime ISO string, hanya level menit (abaikan detik/ms).
 * Jika salah satu null/empty, pakai aturan _isDifferent biasa.
 */
function _isDatetimeDifferent(
  fromDB: string | null | undefined,
  fromSheet: string | null | undefined
): boolean {
  const b = (fromSheet || '').trim();
  if (!b) return false; // GSheet kosong → skip
  const a = (fromDB || '').trim();
  if (!a) return true;  // DB kosong tapi GSheet ada → berbeda

  try {
    const dA = new Date(a);
    const dB = new Date(b);
    if (isNaN(dA.getTime()) || isNaN(dB.getTime())) return a !== b;
    // Bandingkan sampai level menit
    return Math.floor(dA.getTime() / 60000) !== Math.floor(dB.getTime() / 60000);
  } catch {
    return a !== b;
  }
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
      h => _SYNC_COLUMN_MAP[h.toLowerCase().trim().replace(/\s+/g, ' ')] ?? null
    );

    const unmappedHeaders = rawHeaders.filter(h => {
      const lower = h.toLowerCase().trim().replace(/\s+/g, ' ');
      return !_SYNC_COLUMN_MAP[lower] && !_IGNORED_HEADERS.has(lower);
    });

    console.log('[Preview] Header mapping:', rawHeaders.map((h, i) => `"${h}" → ${headers[i] ?? 'null'}`).join(' | '));
    if (unmappedHeaders.length > 0) {
      console.warn('[Preview] ⚠️ Unmapped headers:', unmappedHeaders);
    }

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

      headers.forEach((col, i) => {
        if (!col || col === 'detail_case' || col === 'check_in' || col === 'check_out') return;
        let val: string | null = (row[i] || '').trim() || null;
        if (col === 'date' && val)        val = _normalizeSyncDate(val);
        if (col === 'client_name' && val) val = normalizeClientName(val);
        fields[col] = val;
      });

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

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('all_cases')
      .select('ticket_number, status_case, check_in, check_out, client_name, module_case, category_case, detail_module, pic_client, detail_case, source_link_op, note, month, date')
      .in('ticket_number', allTickets)
      .is('deleted_at', null);

    if (fetchErr) return { success: false, error: `DB error: ${fetchErr.message}` };

    const existingMap = new Map<string, Record<string, any>>(
      (existing || []).map((r: any) => [r.ticket_number, r])
    );

    // ── Baris baru (INSERT) ───────────────────────────────────────────────────
    const toInsert: PreviewRow[] = rawRecords
      .filter(r => !existingMap.has(r.ticket_number))
      .map(r => ({
        ticket_number:   r.fields.ticket_number,
        date:            r.fields.date            ?? null,
        month:           r.fields.month           ?? null,
        client_name:     r.fields.client_name     ?? null,
        pic_client:      r.fields.pic_client      ?? null,
        status_case:     r.fields.status_case     ?? null,
        category_case:   r.fields.category_case   ?? null,
        module_case:     r.fields.module_case     ?? null,
        detail_module:   r.fields.detail_module   ?? null,
        check_in:        r.fields.check_in        ?? null,
        detail_case:     r.fields.detail_case     ?? null,
        detail_case_raw: r.detail_case_raw,
        note:            r.fields.note            ?? null,
      }));

    // ── Baris yang perlu di-UPDATE ────────────────────────────────────────────
    const toUpdate: PreviewUpdateRow[] = [];

    for (const r of rawRecords) {
      const db = existingMap.get(r.ticket_number);
      if (!db) continue;

      const changes: PreviewUpdateRow['changes'] = {};

      // ── Field perbandingan — TIDAK termasuk "date" (user jarang ubah tanggal) ──
      // Hanya 5 field utama yang user sering ubah: Status, Client, Kategori, Modul, Detail Modul
      // Plus field lain sebagai bonus

      if (_isDifferent(db.status_case,    r.fields.status_case))
        changes.status_case    = { from: db.status_case,    to: r.fields.status_case };

      if (_isDifferent(db.client_name,    r.fields.client_name))
        changes.client_name    = { from: db.client_name,    to: r.fields.client_name };

      if (_isDifferent(db.category_case,  r.fields.category_case))
        changes.category_case  = { from: db.category_case,  to: r.fields.category_case };

      if (_isDifferent(db.module_case,    r.fields.module_case))
        changes.module_case    = { from: db.module_case,    to: r.fields.module_case };

      if (_isDifferent(db.detail_module,  r.fields.detail_module))
        changes.detail_module  = { from: db.detail_module,  to: r.fields.detail_module };

      if (_isDifferent(db.pic_client,     r.fields.pic_client))
        changes.pic_client     = { from: db.pic_client,     to: r.fields.pic_client };

      if (_isDifferent(db.detail_case,    r.fields.detail_case))
        changes.detail_case    = { from: db.detail_case,    to: r.fields.detail_case };

      if (_isDifferent(db.source_link_op, r.fields.source_link_op))
        changes.source_link_op = { from: db.source_link_op, to: r.fields.source_link_op };

      if (_isDifferent(db.note,           r.fields.note))
        changes.note           = { from: db.note,           to: r.fields.note };

      if (_isDifferent(db.month,          r.fields.month))
        changes.month          = { from: db.month,          to: r.fields.month };

      // check_in & check_out: hanya isi jika DB masih kosong
      if (!db.check_in  && r.fields.check_in)
        changes.check_in       = { from: null, to: r.fields.check_in };

      if (!db.check_out && r.fields.check_out)
        changes.check_out      = { from: null, to: r.fields.check_out };

      if (Object.keys(changes).length === 0) continue;

      // Build human-readable changed field labels
      const changedFields = Object.keys(changes).map(k => FIELD_LABELS[k] ?? k);

      console.log(`[Preview] 🔄 ${r.ticket_number} — berubah: ${changedFields.join(', ')}`);

      toUpdate.push({
        ticket_number: r.ticket_number,
        // Flat display: nilai terbaru dari GSheet, fallback ke DB
        date:          r.fields.date          ?? db.date          ?? null,
        client_name:   r.fields.client_name   ?? db.client_name   ?? null,
        status_case:   r.fields.status_case   ?? db.status_case   ?? null,
        category_case: r.fields.category_case ?? db.category_case ?? null,
        module_case:   r.fields.module_case   ?? db.module_case   ?? null,
        detail_module: r.fields.detail_module ?? db.detail_module ?? null,
        detail_case:   r.fields.detail_case   ?? db.detail_case   ?? null,
        changes,
        changedFields,
      });
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