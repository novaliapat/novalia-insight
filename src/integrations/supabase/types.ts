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
      declaration_audit_logs: {
        Row: {
          action: string
          created_at: string
          declaration_id: string
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          declaration_id: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          declaration_id?: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "declaration_audit_logs_declaration_id_fkey"
            columns: ["declaration_id"]
            isOneToOne: false
            referencedRelation: "declarations"
            referencedColumns: ["id"]
          },
        ]
      }
      declaration_extracted_data: {
        Row: {
          confidence_score: number | null
          created_at: string
          declaration_id: string
          detected_categories: Database["public"]["Enums"]["tax_category"][]
          extracted_data: Json
          extraction_status: string
          id: string
          metadata: Json
          updated_at: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          declaration_id: string
          detected_categories?: Database["public"]["Enums"]["tax_category"][]
          extracted_data?: Json
          extraction_status?: string
          id?: string
          metadata?: Json
          updated_at?: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          declaration_id?: string
          detected_categories?: Database["public"]["Enums"]["tax_category"][]
          extracted_data?: Json
          extraction_status?: string
          id?: string
          metadata?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "declaration_extracted_data_declaration_id_fkey"
            columns: ["declaration_id"]
            isOneToOne: true
            referencedRelation: "declarations"
            referencedColumns: ["id"]
          },
        ]
      }
      declaration_files: {
        Row: {
          created_at: string
          declaration_id: string
          file_name: string
          file_type: string | null
          id: string
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          declaration_id: string
          file_name: string
          file_type?: string | null
          id?: string
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          declaration_id?: string
          file_name?: string
          file_type?: string | null
          id?: string
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "declaration_files_declaration_id_fkey"
            columns: ["declaration_id"]
            isOneToOne: false
            referencedRelation: "declarations"
            referencedColumns: ["id"]
          },
        ]
      }
      declaration_fiscal_analysis: {
        Row: {
          analysis: Json
          created_at: string
          declaration_id: string
          id: string
          updated_at: string
        }
        Insert: {
          analysis?: Json
          created_at?: string
          declaration_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          analysis?: Json
          created_at?: string
          declaration_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "declaration_fiscal_analysis_declaration_id_fkey"
            columns: ["declaration_id"]
            isOneToOne: true
            referencedRelation: "declarations"
            referencedColumns: ["id"]
          },
        ]
      }
      declaration_review_items: {
        Row: {
          audit_log_id: string | null
          created_at: string
          declaration_id: string
          dedup_key: string
          field: string | null
          id: string
          message: string
          note: string | null
          severity: string
          source_code: string | null
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          audit_log_id?: string | null
          created_at?: string
          declaration_id: string
          dedup_key: string
          field?: string | null
          id?: string
          message: string
          note?: string | null
          severity?: string
          source_code?: string | null
          source_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          audit_log_id?: string | null
          created_at?: string
          declaration_id?: string
          dedup_key?: string
          field?: string | null
          id?: string
          message?: string
          note?: string | null
          severity?: string
          source_code?: string | null
          source_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      declaration_validated_data: {
        Row: {
          declaration_id: string
          id: string
          validated_at: string
          validated_data: Json
        }
        Insert: {
          declaration_id: string
          id?: string
          validated_at?: string
          validated_data?: Json
        }
        Update: {
          declaration_id?: string
          id?: string
          validated_at?: string
          validated_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "declaration_validated_data_declaration_id_fkey"
            columns: ["declaration_id"]
            isOneToOne: true
            referencedRelation: "declarations"
            referencedColumns: ["id"]
          },
        ]
      }
      declarations: {
        Row: {
          created_at: string
          id: string
          status: Database["public"]["Enums"]["declaration_status"]
          tax_year: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["declaration_status"]
          tax_year?: number
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["declaration_status"]
          tax_year?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      owns_declaration: { Args: { _declaration_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      declaration_status:
        | "draft"
        | "extraction_pending"
        | "extraction_done"
        | "validation_pending"
        | "analysis_pending"
        | "finalized"
      tax_category:
        | "ifu"
        | "scpi"
        | "life_insurance"
        | "real_estate_income"
        | "dividends"
        | "interests"
        | "capital_gains"
        | "foreign_accounts"
        | "per"
        | "tax_credits"
        | "deductible_expenses"
        | "other"
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
    Enums: {
      app_role: ["admin", "user"],
      declaration_status: [
        "draft",
        "extraction_pending",
        "extraction_done",
        "validation_pending",
        "analysis_pending",
        "finalized",
      ],
      tax_category: [
        "ifu",
        "scpi",
        "life_insurance",
        "real_estate_income",
        "dividends",
        "interests",
        "capital_gains",
        "foreign_accounts",
        "per",
        "tax_credits",
        "deductible_expenses",
        "other",
      ],
    },
  },
} as const
