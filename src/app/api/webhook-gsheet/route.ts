/**
 * src/app/api/webhook-gsheet/route.ts
 *
 * Menerima POST dari Google Apps Script saat GSheet diedit.
 * Langsung sync tanpa preview — pakai syncGSheetToDB yang sudah ada.
 */

import { NextResponse } from 'next/server';
import { syncGSheetToDB, getAppSetting } from '@/app/actions';

export const dynamic  = 'force-dynamic';
export const revalidate = 0;

// Rate limit sederhana: max 1 sync per 15 detik
const lastCallMap = new Map<string, number>();

export async function POST(request: Request) {
  try {
    // ── 1. Cek token ────────────────────────────────────────────
    const token = request.headers.get('x-webhook-token');
    if (!process.env.WEBHOOK_SECRET || token !== process.env.WEBHOOK_SECRET) {
      console.warn('[Webhook] ⛔ Token tidak valid');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // ── 2. Rate limit per IP ────────────────────────────────────
    const ip  = request.headers.get('x-forwarded-for') ?? 'default';
    const now = Date.now();
    const last = lastCallMap.get(ip) ?? 0;
    if (now - last < 15_000) {
      console.log(`[Webhook] ⏳ Rate limited (${Math.round((15_000 - (now - last)) / 1000)}s remaining)`);
      return NextResponse.json({ success: false, error: 'Rate limited, try again shortly' }, { status: 429 });
    }
    lastCallMap.set(ip, now);

    // ── 3. Ambil sheetUrl dari body atau fallback ke DB ─────────
    const body     = await request.json().catch(() => ({}));
    let sheetUrl   = (body.sheetUrl as string) || '';

    console.log(`[Webhook] 📥 Event: "${body.event}" | Sheet: "${body.sheetName}" | Range: ${body.editedRange}`);

    if (!sheetUrl) {
      const setting = await getAppSetting('global_sheet_url');
      sheetUrl = setting.value ?? '';
    }

    if (!sheetUrl) {
      return NextResponse.json({ success: false, error: 'Sheet URL tidak ditemukan. Set di Settings page.' }, { status: 400 });
    }

    // ── 4. Sync langsung — tidak perlu preview ──────────────────
    console.log(`[Webhook] 🔄 Sync mulai: ${sheetUrl.slice(0, 60)}...`);
    const start  = Date.now();
    const result = await syncGSheetToDB(sheetUrl);
    const ms     = Date.now() - start;

    if (!result.success) {
      console.error(`[Webhook] ❌ Sync gagal (${ms}ms):`, result.error);
      return NextResponse.json({ ...result, elapsed_ms: ms }, { status: 500 });
    }

    console.log(`[Webhook] ✅ Sync selesai (${ms}ms) — inserted: ${result.inserted}, skipped: ${result.skipped}`);
    return NextResponse.json({ ...result, elapsed_ms: ms });

  } catch (err: any) {
    console.error('[Webhook] 💥 Error:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// Health check — bisa di-GET untuk konfirmasi endpoint aktif
export async function GET() {
  return NextResponse.json({
    status:  'ok',
    message: 'GSheet webhook aktif',
    time:    new Date().toISOString(),
  });
}