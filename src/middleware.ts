import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-min-32-chars-long!!'
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ✅ Skip semua static assets
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico')
  ) {
    return NextResponse.next();
  }

  // ✅ Skip semua /api/* — auth dicek di masing-masing handler
  // Tidak perlu middleware cek token di sini karena bisa sebabkan
  // race condition saat cookie baru di-set oleh /api/auth/login
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth-token')?.value;

  // ✅ Halaman login
  if (pathname.startsWith('/login')) {
    if (token) {
      try {
        await jwtVerify(token, SECRET_KEY);
        // Sudah login → redirect ke dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url));
      } catch {
        // Token invalid/expired → biarkan buka login
        // Hapus cookie yang rusak
        const response = NextResponse.next();
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
    return NextResponse.next();
  }

  // ✅ Semua route lain butuh auth
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    // Simpan intended URL untuk redirect balik setelah login (opsional)
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    await jwtVerify(token, SECRET_KEY);
    return NextResponse.next();
  } catch {
    // Token tidak valid / expired → hapus cookie dan redirect ke login
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
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};