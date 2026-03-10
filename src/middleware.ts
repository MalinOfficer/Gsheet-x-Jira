import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// PENTING: taruh file ini di src/middleware.ts (bukan root)

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-min-32-chars-long!!'
);

// Route yang tidak perlu login
const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout', // ← tambah agar logout tetap bisa dipanggil
  '/api/auth/me',     // ← tambah agar session restore bisa berjalan
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Lewati route publik
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    // Kalau sudah login dan buka /login → redirect ke dashboard
    if (pathname.startsWith('/login')) {
      const token = request.cookies.get('auth-token')?.value;
      if (token) {
        try {
          await jwtVerify(token, SECRET_KEY);
          return NextResponse.redirect(new URL('/dashboard', request.url));
        } catch {
          // Token invalid → biarkan buka /login
        }
      }
    }
    return NextResponse.next();
  }

  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    await jwtVerify(token, SECRET_KEY);
    return NextResponse.next();
  } catch {
    // Token tidak valid / expired → hapus cookie dan redirect ke /login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    return response;
  }
}

export const config = {
  matcher: [
    // Protect semua route kecuali static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};