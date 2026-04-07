import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import type {
  PsProfile,
  PsProfileUpdate,
  PsPrompt,
  PsPromptInsert,
  PsCheckin,
  PsCheckinInsert,
  ShadowCluster,
} from './database.types'

// ─── Profile ────────────────────────────────────────────────────────────────

export function useProfile(userId: string) {
  const [profile, setProfile] = useState<PsProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('ps_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      setError(error.message)
    } else {
      setProfile(data ?? null)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  const updateProfile = async (updates: PsProfileUpdate) => {
    const { error } = await supabase
      .from('ps_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    if (!error) fetch()
    return { error }
  }

  const createProfile = async (initial?: Partial<PsProfileUpdate>) => {
    const { data, error } = await supabase
      .from('ps_profiles')
      .insert({
        user_id: userId,
        vibration_intensity: 2,
        wake_schedule: {},
        prompt_interval_minutes: 90,
        display_contrast: 2,
        onboarding_complete: false,
        shadow_clusters: [],
        ...initial,
      })
      .select()
      .single()
    if (!error) setProfile(data)
    return { data, error }
  }

  return { profile, loading, error, updateProfile, createProfile, refetch: fetch }
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

export function usePrompts(userId?: string, cluster?: ShadowCluster) {
  const [prompts, setPrompts] = useState<PsPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('ps_prompts')
      .select('*')
      .eq('is_active', true)
      .order('cluster')
      .order('weight', { ascending: false })

    // Return system prompts + this user's prompts
    if (userId) {
      query = query.or(`user_id.is.null,user_id.eq.${userId}`)
    } else {
      query = query.is('user_id', null)
    }

    if (cluster) {
      query = query.eq('cluster', cluster)
    }

    const { data, error } = await query
    if (error) setError(error.message)
    else setPrompts(data ?? [])
    setLoading(false)
  }, [userId, cluster])

  useEffect(() => { fetch() }, [fetch])

  const addPrompt = async (prompt: PsPromptInsert) => {
    const { data, error } = await supabase
      .from('ps_prompts')
      .insert(prompt)
      .select()
      .single()
    if (!error) fetch()
    return { data, error }
  }

  const togglePrompt = async (promptId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('ps_prompts')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', promptId)
    if (!error) fetch()
    return { error }
  }

  const deletePrompt = async (promptId: string) => {
    const { error } = await supabase
      .from('ps_prompts')
      .delete()
      .eq('id', promptId)
      .eq('user_id', userId ?? '') // safety: only delete own prompts
    if (!error) fetch()
    return { error }
  }

  return { prompts, loading, error, addPrompt, togglePrompt, deletePrompt, refetch: fetch }
}

// ─── Checkins ────────────────────────────────────────────────────────────────

export function useCheckins(userId: string, limit = 30) {
  const [checkins, setCheckins] = useState<PsCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('ps_checkins')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) setError(error.message)
    else setCheckins(data ?? [])
    setLoading(false)
  }, [userId, limit])

  useEffect(() => { fetch() }, [fetch])

  const logCheckin = async (checkin: PsCheckinInsert) => {
    const { data, error } = await supabase
      .from('ps_checkins')
      .insert(checkin)
      .select()
      .single()
    if (!error) fetch()
    return { data, error }
  }

  const addReflection = async (
    checkinId: string,
    reflection_text: string,
    mood_after?: number
  ) => {
    const { error } = await supabase
      .from('ps_checkins')
      .update({
        reflection_text,
        reflection_at: new Date().toISOString(),
        ...(mood_after !== undefined && { mood_after }),
      })
      .eq('id', checkinId)
    if (!error) fetch()
    return { error }
  }

  // Pick next prompt for the device (weighted random within active prompts)
  const getNextPrompt = async (clusters?: ShadowCluster[]): Promise<PsPrompt | null> => {
    let query = supabase
      .from('ps_prompts')
      .select('*')
      .eq('is_active', true)
      .or(`user_id.is.null,user_id.eq.${userId}`)

    if (clusters?.length) {
      query = query.in('cluster', clusters)
    }

    const { data } = await query
    if (!data || data.length === 0) return null

    // Weighted random selection
    const total = data.reduce((sum, p) => sum + p.weight, 0)
    let rand = Math.random() * total
    for (const prompt of data) {
      rand -= prompt.weight
      if (rand <= 0) return prompt
    }
    return data[data.length - 1]
  }

  return { checkins, loading, error, logCheckin, addReflection, getNextPrompt, refetch: fetch }
}
