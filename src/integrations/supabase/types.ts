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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      answer_keys: {
        Row: {
          correct_numeric_value: number | null
          correct_option_ids: string[] | null
          created_at: string
          id: string
          is_bonus: boolean
          is_cancelled: boolean
          numeric_tolerance: number | null
          question_id: string
          question_type: string
          subject: string
          test_id: string
        }
        Insert: {
          correct_numeric_value?: number | null
          correct_option_ids?: string[] | null
          created_at?: string
          id?: string
          is_bonus?: boolean
          is_cancelled?: boolean
          numeric_tolerance?: number | null
          question_id: string
          question_type: string
          subject: string
          test_id: string
        }
        Update: {
          correct_numeric_value?: number | null
          correct_option_ids?: string[] | null
          created_at?: string
          id?: string
          is_bonus?: boolean
          is_cancelled?: boolean
          numeric_tolerance?: number | null
          question_id?: string
          question_type?: string
          subject?: string
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_keys_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      responses: {
        Row: {
          claimed_numeric_value: number | null
          claimed_option_ids: string[] | null
          created_at: string
          id: string
          marks_awarded: number
          question_id: string
          status: string
          subject: string | null
          submission_id: string
        }
        Insert: {
          claimed_numeric_value?: number | null
          claimed_option_ids?: string[] | null
          created_at?: string
          id?: string
          marks_awarded?: number
          question_id: string
          status: string
          subject?: string | null
          submission_id: string
        }
        Update: {
          claimed_numeric_value?: number | null
          claimed_option_ids?: string[] | null
          created_at?: string
          id?: string
          marks_awarded?: number
          question_id?: string
          status?: string
          subject?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "responses_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          accuracy_percentage: number | null
          chemistry_marks: number | null
          created_at: string
          id: string
          math_marks: number | null
          negative_marks: number | null
          physics_marks: number | null
          share_enabled: boolean
          share_token: string | null
          source_type: string
          test_id: string | null
          total_attempted: number | null
          total_correct: number | null
          total_marks: number | null
          total_unattempted: number | null
          total_wrong: number | null
          user_id: string | null
        }
        Insert: {
          accuracy_percentage?: number | null
          chemistry_marks?: number | null
          created_at?: string
          id?: string
          math_marks?: number | null
          negative_marks?: number | null
          physics_marks?: number | null
          share_enabled?: boolean
          share_token?: string | null
          source_type: string
          test_id?: string | null
          total_attempted?: number | null
          total_correct?: number | null
          total_marks?: number | null
          total_unattempted?: number | null
          total_wrong?: number | null
          user_id?: string | null
        }
        Update: {
          accuracy_percentage?: number | null
          chemistry_marks?: number | null
          created_at?: string
          id?: string
          math_marks?: number | null
          negative_marks?: number | null
          physics_marks?: number | null
          share_enabled?: boolean
          share_token?: string | null
          source_type?: string
          test_id?: string | null
          total_attempted?: number | null
          total_correct?: number | null
          total_marks?: number | null
          total_unattempted?: number | null
          total_wrong?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          created_at: string
          exam_date: string | null
          id: string
          is_active: boolean
          marking_rules_json: Json
          name: string
          shift: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_date?: string | null
          id?: string
          is_active?: boolean
          marking_rules_json?: Json
          name: string
          shift: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_date?: string | null
          id?: string
          is_active?: boolean
          marking_rules_json?: Json
          name?: string
          shift?: string
          updated_at?: string
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
      get_answer_keys_for_test: {
        Args: { p_test_id: string }
        Returns: {
          correct_numeric_value: number
          correct_option_ids: string[]
          is_bonus: boolean
          is_cancelled: boolean
          numeric_tolerance: number
          question_id: string
          question_type: string
          subject: string
        }[]
      }
      get_test_marking_rules: { Args: { p_test_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
    },
  },
} as const
