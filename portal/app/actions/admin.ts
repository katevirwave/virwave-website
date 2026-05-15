'use server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

async function getAdminContext() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const adminClient = createAdminClient()
  const { data: adminRow } = await adminClient.from('admin_users').select('display_name').eq('user_id', user.id).single()
  if (!adminRow) throw new Error('Not an admin')
  return { user, adminClient, adminName: adminRow.display_name }
}

async function logAuditEvent(
  adminClient: ReturnType<typeof createAdminClient>,
  actorId: string, actorEmail: string,
  action: string, targetType: string, targetId: string,
  metadata: Record<string, unknown> = {}
) {
  await adminClient.from('audit_log').insert({
    actor_id: actorId, actor_email: actorEmail,
    action, target_type: targetType, target_id: targetId, metadata,
  })
}

async function sendResendEmail(to: string, subject: string, text: string, html: string) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: 'VirWave <affiliates@virwave.com>', to, subject, text, html }),
  })
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`)
}

export async function approveAffiliate(affiliateId: string, affiliateEmail: string, affiliateCode: string) {
  const { user, adminClient } = await getAdminContext()

  // .eq('status', 'pending') guard — idempotency: double-click cannot re-approve active affiliates
  const { data: updatedRows, error } = await adminClient.from('affiliate_profiles')
    .update({ status: 'active', approved_at: new Date().toISOString() })
    .eq('id', affiliateId)
    .eq('status', 'pending')
    .select('id')
  if (error) throw new Error(`Approve failed: ${error.message}`)

  await logAuditEvent(adminClient, user.id, user.email!, 'affiliate.approve', 'affiliate', affiliateCode)

  // Only send welcome email if the update actually changed a row.
  // Prevents duplicate welcome emails on double-click or repeated form submission.
  if (!updatedRows || updatedRows.length === 0) return

  // Plain welcome email — no magic link. Email security scanners (Proofpoint, Mimecast) consume
  // single-use tokens before the affiliate clicks. Affiliate initiates their own OTP login.
  await sendResendEmail(
    affiliateEmail,
    'Welcome to the VirWave Creator Program',
    `You're in!\n\nSign in at https://affiliates.virwave.com to access your dashboard.\n\nYour referral code: ${affiliateCode}\nYour referral link: https://virwave.com/ref/${affiliateCode}`,
    `<p>You're in! <a href="https://affiliates.virwave.com">Sign in to your dashboard</a> to get started.</p><p>Your code: <strong>${affiliateCode}</strong></p>`
  )

  revalidatePath('/admin/applications')
  revalidatePath('/admin/affiliates')
}

export async function rejectApplication(affiliateId: string, affiliateCode: string, reason: string) {
  const { user, adminClient } = await getAdminContext()

  const { error } = await adminClient.from('affiliate_profiles')
    .update({ status: 'terminated', notes: reason })
    .eq('id', affiliateId)
    .eq('status', 'pending')
  if (error) throw new Error(`Reject failed: ${error.message}`)

  await logAuditEvent(adminClient, user.id, user.email!, 'affiliate.reject', 'affiliate', affiliateCode, { reason })
  revalidatePath('/admin/applications')
}

export async function suspendAffiliate(affiliateId: string, affiliateCode: string, reason: string) {
  const { user, adminClient } = await getAdminContext()

  // Guard: only suspend active/inactive/pending affiliates — prevents suspended→suspended
  // or terminated→suspended transitions that would allow reactivateAffiliate to restore a
  // terminated affiliate back to active.
  await adminClient.from('affiliate_profiles')
    .update({ status: 'suspended', suspended_at: new Date().toISOString(), notes: reason })
    .eq('id', affiliateId)
    .in('status', ['active', 'inactive', 'pending'])

  await logAuditEvent(adminClient, user.id, user.email!, 'affiliate.suspend', 'affiliate', affiliateCode, { reason })
  revalidatePath('/admin/affiliates')
  revalidatePath(`/admin/affiliates/${affiliateCode}`)
}

export async function reactivateAffiliate(affiliateId: string, affiliateCode: string) {
  const { user, adminClient } = await getAdminContext()

  const { error } = await adminClient.from('affiliate_profiles')
    .update({ status: 'active', suspended_at: null, notes: null })
    .eq('id', affiliateId)
    .eq('status', 'suspended')
  if (error) throw new Error(`Reactivate failed: ${error.message}`)

  await logAuditEvent(adminClient, user.id, user.email!, 'affiliate.reactivate', 'affiliate', affiliateCode)
  revalidatePath('/admin/affiliates')
  revalidatePath(`/admin/affiliates/${affiliateCode}`)
}

export async function setTierOverride(affiliateId: string, affiliateCode: string, tier: string | null) {
  const { user, adminClient } = await getAdminContext()

  await adminClient.from('affiliate_profiles')
    .update(tier !== null ? { tier, tier_override: true } : { tier_override: false })
    .eq('id', affiliateId)

  await logAuditEvent(adminClient, user.id, user.email!, 'affiliate.tier_override', 'affiliate', affiliateCode, { tier })
  revalidatePath(`/admin/affiliates/${affiliateCode}`)
}

export async function markPayoutApproved(payoutId: string, affiliateCode: string) {
  const { user, adminClient } = await getAdminContext()

  const { error } = await adminClient.from('affiliate_payouts')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', payoutId)
    .eq('status', 'on_hold')
  if (error) throw new Error(`Approve payout failed: ${error.message}`)

  await logAuditEvent(adminClient, user.id, user.email!, 'payout.approve', 'payout', payoutId, { affiliateCode })
  revalidatePath('/admin/payouts')
}

export async function markPayoutPaid(payoutId: string, affiliateCode: string, referenceNumber: string) {
  const { user, adminClient } = await getAdminContext()

  // .eq('status', 'approved') guard — prevents marking on_hold payouts paid without review
  const { data: payout, error } = await adminClient.from('affiliate_payouts')
    .update({ status: 'paid', paid_at: new Date().toISOString(), payout_reference: referenceNumber })
    .eq('id', payoutId)
    .eq('status', 'approved')
    .select('total_commission_usd, payout_month, payout_method, affiliate_profiles(email, full_name)')
    .single()
  if (error) throw new Error(`Mark paid failed: ${error.message}`)

  // Notify affiliate by email that their payment is on its way
  const profile = (payout?.affiliate_profiles as unknown as { email: string; full_name: string } | null)
  if (profile?.email) {
    const paymentText = [
      `Hi ${profile.full_name ?? affiliateCode},`,
      ``,
      `Your VirWave payment for ${payout.payout_month} is on its way.`,
      ``,
      `Amount: $${(payout.total_commission_usd ?? 0).toFixed(2)} USD`,
      `Method: ${payout.payout_method ?? 'on file'}`,
      ``,
      `See your payout history: https://affiliates.virwave.com/payouts`,
      ``,
      `Thank you for sharing VirWave with your community.`,
      `The VirWave Team`,
    ].join('\n')
    await sendResendEmail(
      profile.email,
      'Your VirWave payment is on its way',
      paymentText,
      `<p>Hi ${profile.full_name ?? affiliateCode},</p><p>Your payment of <strong>$${(payout.total_commission_usd ?? 0).toFixed(2)} USD</strong> for ${payout.payout_month} is on its way via ${payout.payout_method ?? 'the method on file'}.</p><p><a href="https://affiliates.virwave.com/payouts">View your payout history</a></p>`
    )
  }

  await logAuditEvent(adminClient, user.id, user.email!, 'payout.mark_paid', 'payout', payoutId, { affiliateCode, referenceNumber })
  revalidatePath('/admin/payouts')
}

export async function runSettlement(periodMonth: string) {
  const { user, adminClient } = await getAdminContext()

  const { error } = await adminClient.rpc('settle_affiliate_month', { p_month: periodMonth })
  if (error) throw new Error(`Settlement failed: ${error.message}`)

  await logAuditEvent(adminClient, user.id, user.email!, 'settlement.run', 'period', periodMonth)
  revalidatePath('/admin/payouts')
}

export async function resendWelcomeEmail(affiliateEmail: string, affiliateCode: string) {
  const { user } = await getAdminContext()

  await sendResendEmail(
    affiliateEmail,
    'Your VirWave Affiliate Dashboard',
    `Sign in at https://affiliates.virwave.com to access your dashboard.\n\nYour referral code: ${affiliateCode}`,
    `<p><a href="https://affiliates.virwave.com">Sign in to your dashboard</a> — your code is <strong>${affiliateCode}</strong>.</p>`
  )

  const adminClient = createAdminClient()
  await logAuditEvent(adminClient, user.id, user.email!, 'affiliate.resend_welcome', 'affiliate', affiliateCode)
}
