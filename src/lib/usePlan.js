import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

/**
 * Effective plan of the signed-in user: { plan, expires_at, features }.
 * features: max_pages, max_site_pages, max_team, max_products, remove_branding, custom_domain
 */
export function usePlan() {
  const [plan, setPlan] = useState(null)
  const reload = useCallback(async () => {
    const { data } = await supabase.rpc('my_plan')
    setPlan(data || { plan: 'free', features: {} })
  }, [])
  useEffect(() => {
    reload()
  }, [reload])
  return { plan, reload, features: plan?.features || {}, isPaid: Boolean(plan && plan.plan !== 'free') }
}

/** Features of a page owner's plan (team members see the owner's limits) */
export function useOwnerFeatures(ownerId) {
  const [features, setFeatures] = useState(null)
  useEffect(() => {
    if (!ownerId) return
    supabase.rpc('plan_features', { p_user: ownerId }).then(({ data }) => setFeatures(data || {}))
  }, [ownerId])
  return features
}
