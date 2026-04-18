export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      brand_memories: {
        Row: {
          created_at: string
          device_id: string
          differentiation: string
          id: string
          industry: string
          init_step: number
          initialized: boolean
          keywords: string[]
          main_business: string
          name: string
          taboo_words: string[]
          target_customer: string
          tone_of_voice: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string
          differentiation?: string
          id?: string
          industry?: string
          init_step?: number
          initialized?: boolean
          keywords?: string[]
          main_business?: string
          name?: string
          taboo_words?: string[]
          target_customer?: string
          tone_of_voice?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string
          differentiation?: string
          id?: string
          industry?: string
          init_step?: number
          initialized?: boolean
          keywords?: string[]
          main_business?: string
          name?: string
          taboo_words?: string[]
          target_customer?: string
          tone_of_voice?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      content_metrics: {
        Row: {
          ai_insight: string | null
          comments: number
          created_at: string
          device_id: string
          fetched_at: string
          id: string
          likes: number
          platform: string
          review_item_id: string
          saves: number
          shares: number
          source: string
          user_id: string | null
          views: number
        }
        Insert: {
          ai_insight?: string | null
          comments?: number
          created_at?: string
          device_id?: string
          fetched_at?: string
          id?: string
          likes?: number
          platform: string
          review_item_id: string
          saves?: number
          shares?: number
          source?: string
          user_id?: string | null
          views?: number
        }
        Update: {
          ai_insight?: string | null
          comments?: number
          created_at?: string
          device_id?: string
          fetched_at?: string
          id?: string
          likes?: number
          platform?: string
          review_item_id?: string
          saves?: number
          shares?: number
          source?: string
          user_id?: string | null
          views?: number
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_entries: {
        Row: {
          category: string
          confidence: number
          created_at: string
          device_id: string
          evidence: string
          id: string
          insight: string
          type: string
          user_id: string | null
        }
        Insert: {
          category?: string
          confidence?: number
          created_at?: string
          device_id?: string
          evidence?: string
          id?: string
          insight: string
          type?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          confidence?: number
          created_at?: string
          device_id?: string
          evidence?: string
          id?: string
          insight?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempted_at: string
          email: string
          id: string
          ip_address: string
        }
        Insert: {
          attempted_at?: string
          email: string
          id?: string
          ip_address: string
        }
        Update: {
          attempted_at?: string
          email?: string
          id?: string
          ip_address?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          category: string
          confidence: number | null
          content: Json
          created_at: string | null
          device_id: string | null
          evidence: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          layer: string
          source: string | null
          source_url: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          confidence?: number | null
          content?: Json
          created_at?: string | null
          device_id?: string | null
          evidence?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          layer: string
          source?: string | null
          source_url?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          confidence?: number | null
          content?: Json
          created_at?: string | null
          device_id?: string | null
          evidence?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          layer?: string
          source?: string | null
          source_url?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      review_items: {
        Row: {
          auto_generated: boolean
          content: string
          cover_image: string | null
          created_at: string
          cta: string
          device_id: string
          id: string
          metrics_fetched_at: string | null
          platform: string
          published_at: string | null
          published_platforms: string[]
          reject_reason: string | null
          status: string
          tags: string[]
          task_name: string
          task_source: string
          task_topic: string | null
          title: string
          triggered_at: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          auto_generated?: boolean
          content?: string
          cover_image?: string | null
          created_at?: string
          cta?: string
          device_id?: string
          id: string
          metrics_fetched_at?: string | null
          platform?: string
          published_at?: string | null
          published_platforms?: string[]
          reject_reason?: string | null
          status?: string
          tags?: string[]
          task_name?: string
          task_source?: string
          task_topic?: string | null
          title?: string
          triggered_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          auto_generated?: boolean
          content?: string
          cover_image?: string | null
          created_at?: string
          cta?: string
          device_id?: string
          id?: string
          metrics_fetched_at?: string | null
          platform?: string
          published_at?: string | null
          published_platforms?: string[]
          reject_reason?: string | null
          status?: string
          tags?: string[]
          task_name?: string
          task_source?: string
          task_topic?: string | null
          title?: string
          triggered_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      schedule_tasks: {
        Row: {
          created_at: string
          days_of_week: number[]
          device_id: string
          enabled: boolean
          frequency: string
          id: string
          kind: string
          log_content_id: string | null
          log_error: string | null
          log_platform: string | null
          log_status: string | null
          log_timestamp: string | null
          log_topic: string | null
          platforms: string[]
          posts_per_day: number
          scheduled_times: string[]
          style: string
          topics: string[]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          days_of_week?: number[]
          device_id?: string
          enabled?: boolean
          frequency?: string
          id?: string
          kind?: string
          log_content_id?: string | null
          log_error?: string | null
          log_platform?: string | null
          log_status?: string | null
          log_timestamp?: string | null
          log_topic?: string | null
          platforms?: string[]
          posts_per_day?: number
          scheduled_times?: string[]
          style?: string
          topics?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          days_of_week?: number[]
          device_id?: string
          enabled?: boolean
          frequency?: string
          id?: string
          kind?: string
          log_content_id?: string | null
          log_error?: string | null
          log_platform?: string | null
          log_status?: string | null
          log_timestamp?: string | null
          log_topic?: string | null
          platforms?: string[]
          posts_per_day?: number
          scheduled_times?: string[]
          style?: string
          topics?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          auto_cta: boolean
          cover_style: string
          created_at: string
          default_length: string
          default_platform: string
          id: string
          signature: string
          updated_at: string
          user_id: string
          writing_style: string
          writing_tone: string
        }
        Insert: {
          auto_cta?: boolean
          cover_style?: string
          created_at?: string
          default_length?: string
          default_platform?: string
          id?: string
          signature?: string
          updated_at?: string
          user_id: string
          writing_style?: string
          writing_tone?: string
        }
        Update: {
          auto_cta?: boolean
          cover_style?: string
          created_at?: string
          default_length?: string
          default_platform?: string
          id?: string
          signature?: string
          updated_at?: string
          user_id?: string
          writing_style?: string
          writing_tone?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_login_attempts: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
