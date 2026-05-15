// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// /inactive is protected — inactive affiliates still authenticate; the page handles their state
const PROTECTED = ['/dashboard', '/payouts', '/stats', '/profile', '/pending', '/suspended', '/inactive', '/admin']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          )
        },
      },
    }
  )

  // Always use getUser() — validates session server-side; getSession() only parses the local JWT
  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  const isProtected = PROTECTED.some(p => pathname.startsWith(p))
  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Admin route guard: require an admin_users row. Uses the service-role client to
  // bypass RLS — middleware cannot use the anon client's policies. A missing row
  // redirects to /dashboard (authenticated but not admin) rather than / (not logged in).
  if (user && pathname.startsWith('/admin')) {
    const { createClient } = await import('@supabase/supabase-js')
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { count } = await adminClient
      .from('admin_users')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if (!count) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|apply).*)'],
}
