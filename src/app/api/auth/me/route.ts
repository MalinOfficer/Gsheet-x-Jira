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

    const { payload } = await jwtVerify(token, SECRET_KEY);

    // ✅ FIX: Hanya select kolom yang ada di tabel
    // users_account columns: id, username, password, created_at, updated_at
    // Tidak ada: email, role, deleted_at
    const { data: user, error } = await supabaseAdmin
      .from('users_account')
      .select('id, username')
      .eq('id', String(payload.id))
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id:       String(user.id),
        username: user.username,
        email:    payload.email as string ?? '',  // dari JWT payload
        role:     payload.role  as string ?? 'user', // dari JWT payload
      }
    });

  } catch {
    return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
  }
}