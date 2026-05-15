'use server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

// Always-fire OTP — prevents response-timing enumeration.
// shouldCreateUser: true — Supabase must create an auth.users row so the OTP token can be
// stored and verified. Non-affiliates who complete OTP will have a bare auth.users row but
// no affiliate_profiles row; the /callback route detects this and redirects to /?error=access_revoked.
// No emailRedirectTo — OTP flow (6-digit code), not link flow.
export async function requestOTP(email: string): Promise<{ success: true }> {
  const normalizedEmail = email.toLowerCase().trim()
  const adminClient = createAdminClient()
  await adminClient.auth.signInWithOtp({
    email: normalizedEmail,
    options: { shouldCreateUser: true },
  })
  return { success: true }
}

// Verify the 6-digit code entered by the user
export async function verifyOTP(
  email: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.auth.verifyOtp({
    email: email.toLowerCase().trim(),
    token,
    type: 'email',
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Initiate Google OAuth flow
export async function signInWithGoogle(): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://affiliates.virwave.com/callback' },
  })
  if (data.url) redirect(data.url)
}
