// Creator payouts through Razorpay Route: KYC for the linked account, and what a creator may sell.
import { useCallback, useEffect, useState } from 'react'
import { invokeFunction, supabase } from './supabase'
import { useAuth } from '../context/AuthContext'

export const kycStart = (fields) => invokeFunction('razorpay', { action: 'kyc_start', ...fields })
export const kycRefresh = () => invokeFunction('razorpay', { action: 'kyc_status' })

export const KYC_LABEL = {
  not_started: 'Not started',
  created: 'Details sent',
  needs_clarification: 'More details needed',
  under_review: 'Being checked',
  activated: 'Verified',
  suspended: 'Paused',
  rejected: 'Not approved',
}

/** The creator's own payout state: whether Route is on, their KYC row, and whether they can sell */
export function usePayouts() {
  const { user } = useAuth()
  const [state, setState] = useState({ loading: true, route: false, canSell: true, account: null })
  const load = useCallback(async () => {
    if (!user) return
    const [{ data: st }, { data: account }] = await Promise.all([
      supabase.rpc('my_payout_status'),
      supabase.from('payout_accounts').select('status, legal_name, business_type, bank_last4, bank_ifsc, beneficiary_name, requirements, reason, activated_at').eq('user_id', user.id).maybeSingle(),
    ])
    setState({ loading: false, route: Boolean(st?.route_enabled), canSell: st ? Boolean(st.can_sell) : true, account: account || null })
  }, [user])
  useEffect(() => {
    load()
  }, [load])
  return { ...state, reload: load }
}
