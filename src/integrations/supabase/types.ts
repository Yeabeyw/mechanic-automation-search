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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ledger_blocks: {
        Row: {
          block_hash: string
          block_index: number
          created_at: string
          data_hash: string
          event_type: string
          network: string
          payload: string
          prev_hash: string
          record_hash: string | null
          record_ref: string
          record_type: string
          ts: number
          tx_hash: string | null
          block_number: number | null
          contract_address: string | null
        }
        Insert: {
          block_hash: string
          block_index: number
          created_at?: string
          data_hash: string
          event_type: string
          network?: string
          payload: string
          prev_hash: string
          record_hash?: string | null
          record_ref: string
          record_type: string
          ts: number
          tx_hash?: string | null
          block_number?: number | null
          contract_address?: string | null
        }
        Update: {
          block_hash?: string
          block_index?: number
          created_at?: string
          data_hash?: string
          event_type?: string
          network?: string
          payload?: string
          prev_hash?: string
          record_hash?: string | null
          record_ref?: string
          record_type?: string
          ts?: number
          tx_hash?: string | null
          block_number?: number | null
          contract_address?: string | null
        }
        Relationships: []
      }
      mechanics: {
        Row: {
          available: boolean
          bio: string | null
          code: string
          created_at: string
          experience_years: number
          id: string
          is_demo: boolean
          jobs_completed: number
          name: string
          photo_key: string | null
          rating: number
          specialties: string[]
          town: string
          user_id: string | null
          verified: boolean
          workshop: string
        }
        Insert: {
          available?: boolean
          bio?: string | null
          code?: string
          created_at?: string
          experience_years?: number
          id?: string
          is_demo?: boolean
          jobs_completed?: number
          name: string
          photo_key?: string | null
          rating?: number
          specialties?: string[]
          town: string
          user_id?: string | null
          verified?: boolean
          workshop: string
        }
        Update: {
          available?: boolean
          bio?: string | null
          code?: string
          created_at?: string
          experience_years?: number
          id?: string
          is_demo?: boolean
          jobs_completed?: number
          name?: string
          photo_key?: string | null
          rating?: number
          specialties?: string[]
          town?: string
          user_id?: string | null
          verified?: boolean
          workshop?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          town: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          town?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          town?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string
          created_at: string
          customer_id: string
          id: string
          mechanic_id: string
          rating: number
          request_id: string
        }
        Insert: {
          comment?: string
          created_at?: string
          customer_id: string
          id?: string
          mechanic_id: string
          rating: number
          request_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          customer_id?: string
          id?: string
          mechanic_id?: string
          rating?: number
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_mechanic_id_fkey"
            columns: ["mechanic_id"]
            isOneToOne: false
            referencedRelation: "mechanics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          category: string
          contact_phone: string | null
          created_at: string
          customer_id: string
          description: string
          id: string
          mechanic_id: string
          ref: string
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
          vehicle_make: string
          vehicle_model: string
          vehicle_year: number | null
        }
        Insert: {
          category: string
          contact_phone?: string | null
          created_at?: string
          customer_id: string
          description?: string
          id?: string
          mechanic_id: string
          ref?: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          vehicle_make: string
          vehicle_model: string
          vehicle_year?: number | null
        }
        Update: {
          category?: string
          contact_phone?: string | null
          created_at?: string
          customer_id?: string
          description?: string
          id?: string
          mechanic_id?: string
          ref?: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          vehicle_make?: string
          vehicle_model?: string
          vehicle_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_mechanic_id_fkey"
            columns: ["mechanic_id"]
            isOneToOne: false
            referencedRelation: "mechanics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_assigned_mechanic: { Args: { _mechanic_id: string }; Returns: boolean }
      ledger_fingerprint_salt: { Args: { _block_index: number }; Returns: string }
      ledger_append: {
        Args: {
          _data: Json
          _event: string
          _record_ref: string
          _record_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "customer" | "mechanic" | "admin" | "security_admin"
      request_status:
        | "sent"
        | "accepted"
        | "declined"
        | "in_progress"
        | "completed"
        | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["customer", "mechanic", "admin", "security_admin"],
      request_status: [
        "sent",
        "accepted",
        "declined",
        "in_progress",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
