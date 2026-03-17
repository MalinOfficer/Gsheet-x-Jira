import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-min-32-chars-long!!'
);

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username dan password wajib diisi' },
        { status: 400 }
      );
    }

    // ✅ FIX: Hanya select kolom yang ada di tabel
    // users_account columns: id, username, password, created_at, updated_at
    const { data: user, error } = await supabaseAdmin
      .from('users_account')
      .select('id, username, password')
      .eq('username', username)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Username atau password salah' },
        { status: 401 }
      );
    }

    let isValid = false;
    if (user.password?.startsWith('$2')) {
      isValid = await bcrypt.compare(password, user.password);
    } else {
      isValid = password === user.password;
    }

    if (!isValid) {
      return NextResponse.json(
        { error: 'Username atau password salah' },
        { status: 401 }
      );
    }

    // ✅ JWT payload — simpan data yang tersedia
    // email dan role tidak ada di tabel, default ke empty/user
    const token = await new SignJWT({
      id:       String(user.id),
      username: user.username,
      email:    '',       // tidak ada di tabel
      role:     'user',   // tidak ada di tabel, default 'user'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(SECRET_KEY);

    const response = NextResponse.json({
      success: true,
      user: {
        id:       String(user.id),
        username: user.username,
        email:    '',
        role:     'user',
      },
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 24,
      path:     '/',
    });

    return response;

  } catch (error) {
    console.error('❌ [Login] Error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}