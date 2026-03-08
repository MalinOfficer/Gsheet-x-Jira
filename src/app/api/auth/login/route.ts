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

    // Ambil user dari tabel users_account via Supabase
    const { data: user, error } = await supabaseAdmin
      .from('users_account')
      .select('*')
      .eq('username', username)
      .is('deleted_at', null)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Username atau password salah' },
        { status: 401 }
      );
    }

    // Verifikasi password (bcrypt)
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Username atau password salah' },
        { status: 401 }
      );
    }

    // Buat JWT token
    const token = await new SignJWT({
      id:       user.id,
      username: user.username,
      email:    user.email,
      role:     user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(SECRET_KEY);

    const response = NextResponse.json({
      success: true,
      user: {
        id:       user.id,
        username: user.username,
        email:    user.email,
        role:     user.role,
      },
    });

    // Set cookie httpOnly
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 24, // 24 jam
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