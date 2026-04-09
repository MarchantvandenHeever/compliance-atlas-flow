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
      audit_instances: {
        Row: {
          auditor_id: string | null
          created_at: string
          id: string
          last_revised_at: string | null
          period: string
          project_id: string
          revision_count: number
          status: Database["public"]["Enums"]["audit_status"]
          submitted_at: string | null
          template_id: string
          type: Database["public"]["Enums"]["audit_type"]
          updated_at: string
        }
        Insert: {
          auditor_id?: string | null
          created_at?: string
          id?: string
          last_revised_at?: string | null
          period: string
          project_id: string
          revision_count?: number
          status?: Database["public"]["Enums"]["audit_status"]
          submitted_at?: string | null
          template_id: string
          type?: Database["public"]["Enums"]["audit_type"]
          updated_at?: string
        }
        Update: {
          auditor_id?: string | null
          created_at?: string
          id?: string
          last_revised_at?: string | null
          period?: string
          project_id?: string
          revision_count?: number
          status?: Database["public"]["Enums"]["audit_status"]
          submitted_at?: string | null
          template_id?: string
          type?: Database["public"]["Enums"]["audit_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_instances_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_item_responses: {
        Row: {
          actions: string | null
          audit_id: string
          checklist_item_id: string
          comments: string | null
          created_at: string
          id: string
          last_edited_at: string
          last_edited_by: string | null
          status: Database["public"]["Enums"]["compliance_status"] | null
        }
        Insert: {
          actions?: string | null
          audit_id: string
          checklist_item_id: string
          comments?: string | null
          created_at?: string
          id?: string
          last_edited_at?: string
          last_edited_by?: string | null
          status?: Database["public"]["Enums"]["compliance_status"] | null
        }
        Update: {
          actions?: string | null
          audit_id?: string
          checklist_item_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          last_edited_at?: string
          last_edited_by?: string | null
          status?: Database["public"]["Enums"]["compliance_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_item_responses_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audit_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_item_responses_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_revision_log: {
        Row: {
          audit_id: string
          id: string
          previous_status: string
          reason: string | null
          revised_at: string
          revised_by: string
          revision_number: number
        }
        Insert: {
          audit_id: string
          id?: string
          previous_status: string
          reason?: string | null
          revised_at?: string
          revised_by: string
          revision_number: number
        }
        Update: {
          audit_id?: string
          id?: string
          previous_status?: string
          reason?: string | null
          revised_at?: string
          revised_by?: string
          revision_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_revision_log_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audit_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_section_overrides: {
        Row: {
          audit_id: string
          created_at: string
          id: string
          is_active: boolean
          section_id: string
        }
        Insert: {
          audit_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          section_id: string
        }
        Update: {
          audit_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_section_overrides_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audit_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_section_overrides_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "checklist_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          condition_ref: string | null
          description: string
          id: string
          is_active: boolean
          objective_id: string
          sort_order: number
          source: Database["public"]["Enums"]["checklist_source"]
        }
        Insert: {
          condition_ref?: string | null
          description: string
          id?: string
          is_active?: boolean
          objective_id: string
          sort_order?: number
          source: Database["public"]["Enums"]["checklist_source"]
        }
        Update: {
          condition_ref?: string | null
          description?: string
          id?: string
          is_active?: boolean
          objective_id?: string
          sort_order?: number
          source?: Database["public"]["Enums"]["checklist_source"]
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "checklist_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_objectives: {
        Row: {
          id: string
          name: string
          section_id: string
          sort_order: number
          source: Database["public"]["Enums"]["checklist_source"]
        }
        Insert: {
          id?: string
          name: string
          section_id: string
          sort_order?: number
          source: Database["public"]["Enums"]["checklist_source"]
        }
        Update: {
          id?: string
          name?: string
          section_id?: string
          sort_order?: number
          source?: Database["public"]["Enums"]["checklist_source"]
        }
        Relationships: [
          {
            foreignKeyName: "checklist_objectives_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "checklist_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_sections: {
        Row: {
          id: string
          name: string
          sort_order: number
          source: Database["public"]["Enums"]["checklist_source"]
          template_id: string
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
          source: Database["public"]["Enums"]["checklist_source"]
          template_id: string
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
          source?: Database["public"]["Enums"]["checklist_source"]
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          organisation_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organisation_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organisation_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      corrective_actions: {
        Row: {
          assigned_to: string | null
          audit_id: string
          checklist_item_id: string
          created_at: string
          description: string
          id: string
          severity: Database["public"]["Enums"]["action_severity"]
          status: Database["public"]["Enums"]["action_status"]
          target_date: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          audit_id: string
          checklist_item_id: string
          created_at?: string
          description: string
          id?: string
          severity?: Database["public"]["Enums"]["action_severity"]
          status?: Database["public"]["Enums"]["action_status"]
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          audit_id?: string
          checklist_item_id?: string
          created_at?: string
          description?: string
          id?: string
          severity?: Database["public"]["Enums"]["action_severity"]
          status?: Database["public"]["Enums"]["action_status"]
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "corrective_actions_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audit_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_actions_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          audit_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          type: string
          user_id: string
        }
        Insert: {
          audit_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          type: string
          user_id: string
        }
        Update: {
          audit_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audit_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          organisation_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          organisation_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          organisation_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          created_at: string
          id: string
          project_id: string
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_templates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          audit_frequency: string | null
          client: string
          created_at: string
          description: string | null
          id: string
          location: string | null
          name: string
          organisation_id: string
          status: Database["public"]["Enums"]["project_status"]
          template_id: string | null
          updated_at: string
        }
        Insert: {
          audit_frequency?: string | null
          client: string
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          name: string
          organisation_id: string
          status?: Database["public"]["Enums"]["project_status"]
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          audit_frequency?: string | null
          client?: string
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          name?: string
          organisation_id?: string
          status?: Database["public"]["Enums"]["project_status"]
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_projects_template"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      report_review_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          report_review_id: string
          reviewer_id: string
          section: string | null
          status: string
          updated_at: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          report_review_id: string
          reviewer_id: string
          section?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          report_review_id?: string
          reviewer_id?: string
          section?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_review_comments_report_review_id_fkey"
            columns: ["report_review_id"]
            isOneToOne: false
            referencedRelation: "report_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      report_reviews: {
        Row: {
          audit_id: string
          created_at: string
          general_comment: string | null
          id: string
          reviewed_at: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["report_review_status"]
          updated_at: string
        }
        Insert: {
          audit_id: string
          created_at?: string
          general_comment?: string | null
          id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["report_review_status"]
          updated_at?: string
        }
        Update: {
          audit_id?: string
          created_at?: string
          general_comment?: string | null
          id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["report_review_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_reviews_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audit_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      report_versions: {
        Row: {
          created_at: string
          format: string
          id: string
          report_review_id: string
          storage_path: string
          upload_type: string
          uploaded_by: string
          version_number: number
        }
        Insert: {
          created_at?: string
          format?: string
          id?: string
          report_review_id: string
          storage_path: string
          upload_type?: string
          uploaded_by: string
          version_number?: number
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          report_review_id?: string
          storage_path?: string
          upload_type?: string
          uploaded_by?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_versions_report_review_id_fkey"
            columns: ["report_review_id"]
            isOneToOne: false
            referencedRelation: "report_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      response_photos: {
        Row: {
          caption: string | null
          exif_date: string | null
          file_size: number | null
          gps_location: string | null
          id: string
          response_id: string
          storage_path: string
          upload_date: string
        }
        Insert: {
          caption?: string | null
          exif_date?: string | null
          file_size?: number | null
          gps_location?: string | null
          id?: string
          response_id: string
          storage_path: string
          upload_date?: string
        }
        Update: {
          caption?: string | null
          exif_date?: string | null
          file_size?: number | null
          gps_location?: string | null
          id?: string
          response_id?: string
          storage_path?: string
          upload_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "response_photos_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "audit_item_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      review_comments: {
        Row: {
          audit_id: string
          checklist_item_id: string | null
          comment: string
          created_at: string
          id: string
          reviewer_id: string
          status: string
          updated_at: string
        }
        Insert: {
          audit_id: string
          checklist_item_id?: string | null
          comment: string
          created_at?: string
          id?: string
          reviewer_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          audit_id?: string
          checklist_item_id?: string | null
          comment?: string
          created_at?: string
          id?: string
          reviewer_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_comments_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audit_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_comments_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
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
      get_user_org: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      action_severity: "low" | "medium" | "high"
      action_status: "open" | "in_progress" | "closed"
      app_role: "admin" | "eco_auditor" | "reviewer" | "client_viewer"
      audit_status:
        | "draft"
        | "submitted"
        | "approved"
        | "under_review"
        | "amendments_requested"
      audit_type: "daily" | "weekly" | "monthly"
      checklist_source: "EA" | "EMPr"
      compliance_status: "C" | "NC" | "NA"
      project_status: "active" | "completed" | "on_hold"
      report_review_status:
        | "pending_review"
        | "under_review"
        | "amendments_requested"
        | "approved"
        | "disapproved"
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
      action_severity: ["low", "medium", "high"],
      action_status: ["open", "in_progress", "closed"],
      app_role: ["admin", "eco_auditor", "reviewer", "client_viewer"],
      audit_status: [
        "draft",
        "submitted",
        "approved",
        "under_review",
        "amendments_requested",
      ],
      audit_type: ["daily", "weekly", "monthly"],
      checklist_source: ["EA", "EMPr"],
      compliance_status: ["C", "NC", "NA"],
      project_status: ["active", "completed", "on_hold"],
      report_review_status: [
        "pending_review",
        "under_review",
        "amendments_requested",
        "approved",
        "disapproved",
      ],
    },
  },
} as const
