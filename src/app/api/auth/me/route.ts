import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-min-32-chars-long!!'
);

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    // Verifikasi token
    const { payload } = await jwtVerify(token, SECRET_KEY);

    // Ambil data terbaru dari Supabase
    // FIX: gunakan Number() untuk konversi eksplisit, bukan "as string"
    // payload.id dari JWT adalah number — type cast "as string" tidak mengubah nilainya
    // sehingga query Supabase gagal silently dan user tidak ditemukan
    const { data: user, error } = await supabaseAdmin
      .from('users_account')
      .select('id, username, email, role')
      .eq('id', Number(payload.id))
      .is('deleted_at', null)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });

  } catch {
    return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
  }
}