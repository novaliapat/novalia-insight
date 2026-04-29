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
      declaration_exports: {
        Row: {
          created_at: string
          declaration_id: string
          export_type: string
          file_name: string
          id: string
          include_audit: boolean
          include_rag_sources: boolean
          include_review_items: boolean
          metadata: Json
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          declaration_id: string
          export_type?: string
          file_name: string
          id?: string
          include_audit?: boolean
          include_rag_sources?: boolean
          include_review_items?: boolean
          metadata?: Json
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          declaration_id?: string
          export_type?: string
          file_name?: string
          id?: string
          include_audit?: boolean
          include_rag_sources?: boolean
          include_review_items?: boolean
          metadata?: Json
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "declaration_exports_declaration_id_fkey"
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
          model_used: string | null
          prompt_version: string | null
          updated_at: string
        }
        Insert: {
          analysis?: Json
          created_at?: string
          declaration_id: string
          id?: string
          model_used?: string | null
          prompt_version?: string | null
          updated_at?: string
        }
        Update: {
          analysis?: Json
          created_at?: string
          declaration_id?: string
          id?: string
          model_used?: string | null
          prompt_version?: string | null
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
          analysis_status: string
          created_at: string
          id: string
          review_status: string
          status: Database["public"]["Enums"]["declaration_status"]
          tax_year: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_status?: string
          created_at?: string
          id?: string
          review_status?: string
          status?: Database["public"]["Enums"]["declaration_status"]
          tax_year?: number
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_status?: string
          created_at?: string
          id?: string
          review_status?: string
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
      tax_rag_chunks: {
        Row: {
          category: Database["public"]["Enums"]["tax_category"]
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          keywords: string[]
          metadata: Json
          summary: string | null
          tax_year: number | null
        }
        Insert: {
          category: Database["public"]["Enums"]["tax_category"]
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          keywords?: string[]
          metadata?: Json
          summary?: string | null
          tax_year?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["tax_category"]
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          keywords?: string[]
          metadata?: Json
          summary?: string | null
          tax_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_rag_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "tax_rag_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rag_documents: {
        Row: {
          category: Database["public"]["Enums"]["tax_category"]
          created_at: string
          document_date: string | null
          id: string
          is_official_source: boolean
          metadata: Json
          source_name: string | null
          source_type: string
          source_url: string | null
          status: string
          storage_path: string | null
          tax_year: number | null
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["tax_category"]
          created_at?: string
          document_date?: string | null
          id?: string
          is_official_source?: boolean
          metadata?: Json
          source_name?: string | null
          source_type: string
          source_url?: string | null
          status?: string
          storage_path?: string | null
          tax_year?: number | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["tax_category"]
          created_at?: string
          document_date?: string | null
          id?: string
          is_official_source?: boolean
          metadata?: Json
          source_name?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          storage_path?: string | null
          tax_year?: number | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      tax_rag_queries: {
        Row: {
          category: Database["public"]["Enums"]["tax_category"]
          created_at: string
          declaration_id: string | null
          id: string
          query: string
          retrieved_chunk_ids: string[]
          top_score: number | null
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["tax_category"]
          created_at?: string
          declaration_id?: string | null
          id?: string
          query: string
          retrieved_chunk_ids?: string[]
          top_score?: number | null
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["tax_category"]
          created_at?: string
          declaration_id?: string | null
          id?: string
          query?: string
          retrieved_chunk_ids?: string[]
          top_score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rag_queries_declaration_id_fkey"
            columns: ["declaration_id"]
            isOneToOne: false
            referencedRelation: "declarations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rag_sources_used: {
        Row: {
          analysis_id: string | null
          category: Database["public"]["Enums"]["tax_category"]
          chunk_id: string | null
          created_at: string
          declaration_id: string | null
          document_id: string | null
          id: string
          relevance_score: number | null
          used_in_answer: boolean
        }
        Insert: {
          analysis_id?: string | null
          category: Database["public"]["Enums"]["tax_category"]
          chunk_id?: string | null
          created_at?: string
          declaration_id?: string | null
          document_id?: string | null
          id?: string
          relevance_score?: number | null
          used_in_answer?: boolean
        }
        Update: {
          analysis_id?: string | null
          category?: Database["public"]["Enums"]["tax_category"]
          chunk_id?: string | null
          created_at?: string
          declaration_id?: string | null
          document_id?: string | null
          id?: string
          relevance_score?: number | null
          used_in_answer?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tax_rag_sources_used_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "tax_rag_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_rag_sources_used_declaration_id_fkey"
            columns: ["declaration_id"]
            isOneToOne: false
            referencedRelation: "declarations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_rag_sources_used_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "tax_rag_documents"
            referencedColumns: ["id"]
          },
        ]
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
      match_tax_rag_chunks: {
        Args: {
          match_category: Database["public"]["Enums"]["tax_category"]
          match_count?: number
          match_tax_year?: number
          query_embedding: string
        }
        Returns: {
          category: Database["public"]["Enums"]["tax_category"]
          chunk_id: string
          content: string
          document_date: string
          document_id: string
          is_official_source: boolean
          keywords: string[]
          similarity: number
          source_name: string
          source_url: string
          summary: string
          tax_year: number
          title: string
        }[]
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
