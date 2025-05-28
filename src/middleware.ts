import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAdminRoute = req.nextUrl.pathname.startsWith('/users');
    const isLoginPage = req.nextUrl.pathname === '/login';

    // Redirect to login if not authenticated
    if (!token && !isLoginPage) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // Redirect non-admin users trying to access admin routes
    if (isAdminRoute && token?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to login page without token
        if (req.nextUrl.pathname === '/login') return true;
        // Require token for all other routes
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}; 