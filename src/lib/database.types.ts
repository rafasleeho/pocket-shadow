export type ShadowCluster =
  | 'body_signals'
  | 'unresolvable_situations'
  | 'claiming_space'
  | 'best_self_reference'
  | 'perceived_vs_actual'

export type PromptSource = 'system' | 'user' | 'ai_generated'

export interface PsProfile {
  id: string
  user_id: string
  display_name: string | null
  // shadow profile
  mbti_blend: string | null
  shadow_pattern: string | null
  core_trigger: string | null
  shadow_clusters: ShadowCluster[]
  // device preferences
  vibration_intensity: number       // 1–5
  wake_schedule: Record<string, unknown>
  prompt_interval_minutes: number
  display_contrast: number          // 1–3
  // meta
  onboarding_complete: boolean
  created_at: string
  updated_at: string
}

export interface PsPrompt {
  id: string
  user_id: string | null            // null = system prompt
  cluster: ShadowCluster
  prompt_text: string
  is_active: boolean
  weight: number                    // 1–10, affects delivery frequency
  source: PromptSource
  tags: string[]
  created_at: string
  updated_at: string
}

export interface PsCheckin {
  id: string
  user_id: string
  prompt_id: string | null
  prompt_text: string               // snapshot at delivery time
  cluster: ShadowCluster
  // device interaction
  acknowledged: boolean
  acknowledged_at: string | null
  device_id: string | null
  // optional web-layer reflection
  reflection_text: string | null
  reflection_at: string | null
  mood_before: number | null        // 1–5
  mood_after: number | null         // 1–5
  // meta
  created_at: string
}

// Insert/update types (omit generated fields)
export type PsProfileInsert = Omit<PsProfile, 'id' | 'created_at' | 'updated_at'>
export type PsProfileUpdate = Partial<PsProfileInsert>

export type PsPromptInsert = Omit<PsPrompt, 'id' | 'created_at' | 'updated_at'>
export type PsPromptUpdate = Partial<PsPromptInsert>

export type PsCheckinInsert = Omit<PsCheckin, 'id' | 'created_at'>
export type PsCheckinUpdate = Partial<PsCheckinInsert>

// Re-export as Database namespace for createClient<Database> usage
export interface Database {
  public: {
    Tables: {
      ps_profiles: {
        Row: PsProfile
        Insert: PsProfileInsert
        Update: PsProfileUpdate
      }
      ps_prompts: {
        Row: PsPrompt
        Insert: PsPromptInsert
        Update: PsPromptUpdate
      }
      ps_checkins: {
        Row: PsCheckin
        Insert: PsCheckinInsert
        Update: PsCheckinUpdate
      }
    }
  }
}
