import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicRoutes = ['/login', '/forgot-password'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  const isPublicRoute = publicRoutes.includes(request.nextUrl.pathname);

  // Note: Client-side usually stores token in localStorage, 
  // but middleware only has access to cookies. 
  // We'll primarily rely on client-side protection (AuthGuard), 
  // but here we can do basic routing if we decide to set cookies later.

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
