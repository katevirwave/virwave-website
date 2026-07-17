// app/callback/route.ts
//
// Handles two entry points:
//   1. Google OAuth callback — URL has ?code=... → exchange code for session, then route
//   2. OTP post-verification — client calls router.push('/callback') with no code → use existing session
//
// Profile-linking and status routing run unconditionally for both paths.
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/?error=${error}`)
  }

  const supabase = createSupabaseServerClient()

  // Step 1: Exchange OAuth code if present (Google OAuth path).
  // OTP path skips this — session is already set by verifyOTP Server Action.
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      return NextResponse.redirect(`${origin}/?error=auth_failed`)
    }
  }

  // Step 2: Validate session — runs for BOTH OAuth and OTP paths.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.redirect(`${origin}/?error=no_user`)
  }

  const adminClient = createAdminClient()

  // Step 3: Admin check — admins bypass affiliate routing entirely.
  const { data: adminRow } = await adminClient
    .from('admin_users').select('id').eq('user_id', user.id).single()
  if (adminRow) {
    return NextResponse.redirect(`${origin}/admin/dashboard`)
  }

  // Step 4: Link affiliate_profiles.user_id if not already set (idempotent).
  const { error: linkError } = await supabase.rpc('link_affiliate_portal_user')
  if (linkError) console.error('[link_affiliate_portal_user]', linkError.message)

  // Step 5: Affiliate status routing + non-affiliate sign-out.
  // Query by user_id first (set by link_affiliate_portal_user on every login).
  // Fall back to email only for brand-new accounts whose user_id was just set
  // and may not yet be reflected in this read (edge: same-request race).
  // This guards against auth email change: email in auth.users can change but
  // affiliate_profiles.email retains the original application email.
  const { data: profileById } = await adminClient
    .from('affiliate_profiles')
    .select('status')
    .eq('user_id', user.id)
    .single()

  const { data: profile } = profileById
    ? { data: profileById }
    : await adminClient
        .from('affiliate_profiles')
        .select('status')
        .eq('email', user.email.toLowerCase())
        .single()

  if (!profile || !['active', 'inactive', 'pending'].includes(profile.status)) {
    // Non-affiliates, suspended, and terminated users: sign out and block.
    // 'inactive' is allowed — inactive affiliates see a reduced dashboard with reactivation CTA.
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/?error=access_revoked`)
  }

  if (profile.status === 'pending') return NextResponse.redirect(`${origin}/pending`)
  if (profile.status === 'inactive') return NextResponse.redirect(`${origin}/inactive`)
  return NextResponse.redirect(`${origin}/dashboard`)
}
