import { NextRequest, NextResponse } from 'next/server';

// ✅ POST — dipanggil dari tombol Logout di UI
export async function POST() {
  const response = NextResponse.json({ success: true });

  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   0,
    path:     '/',
  });

  return response;
}

// ✅ GET — untuk clear cookie manual via browser address bar
// Berguna saat tombol logout tidak bisa diklik (misal stuck di loading)
// Cara pakai: buka /api/auth/logout di browser → cookie terhapus → redirect ke /login
export async function GET(request: NextRequest) {
  const baseUrl  = request.nextUrl.origin;
  const response = NextResponse.redirect(new URL('/login', baseUrl));

  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   0,
    path:     '/',
  });

  return response;
}