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
      exam_sections: {
        Row: {
          code: string
          created_at: string
          exam_id: string
          id: string
          module_type: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          exam_id: string
          id?: string
          module_type: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          exam_id?: string
          id?: string
          module_type?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_sections_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      images: {
        Row: {
          id: string
          label: string | null
          processed: boolean
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          id?: string
          label?: string | null
          processed?: boolean
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          id?: string
          label?: string | null
          processed?: boolean
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      page_views: {
        Row: {
          country: string | null
          created_at: string
          device: string | null
          duration_ms: number | null
          id: string
          path: string
          referrer: string | null
          user_agent: string | null
          user_id: string | null
          visitor_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          device?: string | null
          duration_ms?: number | null
          id?: string
          path: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
          visitor_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          device?: string | null
          duration_ms?: number | null
          id?: string
          path?: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      passage_sentences: {
        Row: {
          id: string
          label: string | null
          passage_id: string
          sentence_index: number
          text: string
        }
        Insert: {
          id?: string
          label?: string | null
          passage_id: string
          sentence_index: number
          text: string
        }
        Update: {
          id?: string
          label?: string | null
          passage_id?: string
          sentence_index?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "passage_sentences_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "passages"
            referencedColumns: ["id"]
          },
        ]
      }
      passages: {
        Row: {
          body_text: string
          created_at: string
          difficulty_rating: number
          exam_section_id: string
          id: string
          seed_key: string | null
          source: string
          status: string
          title: string
          topic_tag: string | null
          updated_at: string
          word_count: number | null
        }
        Insert: {
          body_text: string
          created_at?: string
          difficulty_rating?: number
          exam_section_id: string
          id?: string
          seed_key?: string | null
          source?: string
          status?: string
          title: string
          topic_tag?: string | null
          updated_at?: string
          word_count?: number | null
        }
        Update: {
          body_text?: string
          created_at?: string
          difficulty_rating?: number
          exam_section_id?: string
          id?: string
          seed_key?: string | null
          source?: string
          status?: string
          title?: string
          topic_tag?: string | null
          updated_at?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "passages_exam_section_id_fkey"
            columns: ["exam_section_id"]
            isOneToOne: false
            referencedRelation: "exam_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          blank_number: number | null
          choices: Json
          correct_choice_index: number
          created_at: string
          difficulty_rating: number
          evidence_sentence_ids: string[] | null
          exam_section_id: string
          explanation: string | null
          id: string
          passage_id: string | null
          prompt: string
          seed_key: string | null
          source: string
          status: string
          subskill_ids: string[]
          updated_at: string
        }
        Insert: {
          blank_number?: number | null
          choices: Json
          correct_choice_index: number
          created_at?: string
          difficulty_rating?: number
          evidence_sentence_ids?: string[] | null
          exam_section_id: string
          explanation?: string | null
          id?: string
          passage_id?: string | null
          prompt: string
          seed_key?: string | null
          source?: string
          status?: string
          subskill_ids?: string[]
          updated_at?: string
        }
        Update: {
          blank_number?: number | null
          choices?: Json
          correct_choice_index?: number
          created_at?: string
          difficulty_rating?: number
          evidence_sentence_ids?: string[] | null
          exam_section_id?: string
          explanation?: string | null
          id?: string
          passage_id?: string | null
          prompt?: string
          seed_key?: string | null
          source?: string
          status?: string
          subskill_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_exam_section_id_fkey"
            columns: ["exam_section_id"]
            isOneToOne: false
            referencedRelation: "exam_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "passages"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_results: {
        Row: {
          correct: boolean
          id: string
          student_id: string
          taken_at: string
          word_id: string
        }
        Insert: {
          correct: boolean
          id?: string
          student_id: string
          taken_at?: string
          word_id: string
        }
        Update: {
          correct?: boolean
          id?: string
          student_id?: string
          taken_at?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_results_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_attempts: {
        Row: {
          id: string
          kind: string
          score: number
          stage_index: number | null
          student_id: string
          taken_at: string
          total: number
          world: string | null
        }
        Insert: {
          id?: string
          kind: string
          score: number
          stage_index?: number | null
          student_id: string
          taken_at?: string
          total: number
          world?: string | null
        }
        Update: {
          id?: string
          kind?: string
          score?: number
          stage_index?: number | null
          student_id?: string
          taken_at?: string
          total?: number
          world?: string | null
        }
        Relationships: []
      }
      student_badges: {
        Row: {
          badge_key: string
          earned_at: string
          id: string
          student_id: string
        }
        Insert: {
          badge_key: string
          earned_at?: string
          id?: string
          student_id: string
        }
        Update: {
          badge_key?: string
          earned_at?: string
          id?: string
          student_id?: string
        }
        Relationships: []
      }
      student_stats: {
        Row: {
          current_streak: number
          last_active_date: string | null
          longest_streak: number
          student_id: string
          updated_at: string
          xp: number
        }
        Insert: {
          current_streak?: number
          last_active_date?: string | null
          longest_streak?: number
          student_id: string
          updated_at?: string
          xp?: number
        }
        Update: {
          current_streak?: number
          last_active_date?: string | null
          longest_streak?: number
          student_id?: string
          updated_at?: string
          xp?: number
        }
        Relationships: []
      }
      student_word_order: {
        Row: {
          created_at: string
          position: number
          student_id: string
          word_id: string
          world: string | null
        }
        Insert: {
          created_at?: string
          position: number
          student_id: string
          word_id: string
          world?: string | null
        }
        Update: {
          created_at?: string
          position?: number
          student_id?: string
          word_id?: string
          world?: string | null
        }
        Relationships: []
      }
      study_progress: {
        Row: {
          current_stage: number
          current_world: string | null
          stage_size: number
          student_id: string
          updated_at: string
        }
        Insert: {
          current_stage?: number
          current_world?: string | null
          stage_size?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          current_stage?: number
          current_world?: string | null
          stage_size?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      subskills: {
        Row: {
          created_at: string
          exam_section_id: string
          id: string
          key: string
          label_en: string
          label_ja: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          exam_section_id: string
          id?: string
          key: string
          label_en: string
          label_ja: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          exam_section_id?: string
          id?: string
          key?: string
          label_en?: string
          label_ja?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "subskills_exam_section_id_fkey"
            columns: ["exam_section_id"]
            isOneToOne: false
            referencedRelation: "exam_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_answers: {
        Row: {
          answered_at: string
          evidence_outcome: string | null
          id: string
          is_correct: boolean
          question_id: string
          selected_choice_index: number
          tapped_sentence_id: string | null
          user_id: string
          user_session_id: string | null
        }
        Insert: {
          answered_at?: string
          evidence_outcome?: string | null
          id?: string
          is_correct: boolean
          question_id: string
          selected_choice_index: number
          tapped_sentence_id?: string | null
          user_id: string
          user_session_id?: string | null
        }
        Update: {
          answered_at?: string
          evidence_outcome?: string | null
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_choice_index?: number
          tapped_sentence_id?: string | null
          user_id?: string
          user_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_answers_tapped_sentence_id_fkey"
            columns: ["tapped_sentence_id"]
            isOneToOne: false
            referencedRelation: "passage_sentences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_answers_user_session_id_fkey"
            columns: ["user_session_id"]
            isOneToOne: false
            referencedRelation: "user_sessions"
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
      user_sessions: {
        Row: {
          ended_at: string | null
          id: string
          module_type: string
          questions_served: string[]
          started_at: string
          user_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          module_type: string
          questions_served?: string[]
          started_at?: string
          user_id: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          module_type?: string
          questions_served?: string[]
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subskill_stats: {
        Row: {
          attempts: number
          correct: number
          id: string
          last_practiced_at: string | null
          rolling_accuracy: number
          subskill_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          correct?: number
          id?: string
          last_practiced_at?: string | null
          rolling_accuracy?: number
          subskill_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          correct?: number
          id?: string
          last_practiced_at?: string | null
          rolling_accuracy?: number
          subskill_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subskill_stats_subskill_id_fkey"
            columns: ["subskill_id"]
            isOneToOne: false
            referencedRelation: "subskills"
            referencedColumns: ["id"]
          },
        ]
      }
      word_status: {
        Row: {
          id: string
          mastery: number
          student_id: string
          updated_at: string
          word_id: string
        }
        Insert: {
          id?: string
          mastery?: number
          student_id: string
          updated_at?: string
          word_id: string
        }
        Update: {
          id?: string
          mastery?: number
          student_id?: string
          updated_at?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "word_status_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      words: {
        Row: {
          alt_example_sentence: string | null
          category: string | null
          created_at: string
          definition: string
          definition_ja: string | null
          example_sentence: string | null
          id: string
          is_active: boolean
          part_of_speech: string | null
          source_image_id: string | null
          tier: string | null
          word: string
        }
        Insert: {
          alt_example_sentence?: string | null
          category?: string | null
          created_at?: string
          definition: string
          definition_ja?: string | null
          example_sentence?: string | null
          id?: string
          is_active?: boolean
          part_of_speech?: string | null
          source_image_id?: string | null
          tier?: string | null
          word: string
        }
        Update: {
          alt_example_sentence?: string | null
          category?: string | null
          created_at?: string
          definition?: string
          definition_ja?: string | null
          example_sentence?: string | null
          id?: string
          is_active?: boolean
          part_of_speech?: string | null
          source_image_id?: string | null
          tier?: string | null
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "words_source_image_id_fkey"
            columns: ["source_image_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
        ]
      }
      world_progress: {
        Row: {
          current_stage: number
          student_id: string
          updated_at: string
          world: string
        }
        Insert: {
          current_stage?: number
          student_id: string
          updated_at?: string
          world: string
        }
        Update: {
          current_stage?: number
          student_id?: string
          updated_at?: string
          world?: string
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
    }
    Enums: {
      app_role: "admin" | "student"
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
      app_role: ["admin", "student"],
    },
  },
} as const
