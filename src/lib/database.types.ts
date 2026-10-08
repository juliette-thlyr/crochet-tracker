
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "part_instructions": {
                  Row: {
                    "created_at": string,"id": string,"image_path": string,"kind": string,"pattern_part_id": string,"pdf_page": number | null,"position": number,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"image_path": string,"kind": string,"pattern_part_id": string,"pdf_page"?: number | null,"position"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"image_path"?: string,"kind"?: string,"pattern_part_id"?: string,"pdf_page"?: number | null,"position"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "part_instructions_pattern_part_id_fkey"
      columns: ["pattern_part_id"]
isOneToOne: false
      referencedRelation: "pattern_parts"
      referencedColumns: ["id"]
    }
                  ]
                },"part_yarns": {
                  Row: {
                    "created_at": string,"id": string,"part_id": string,"skeins_used": number,"updated_at": string,"user_id": string,"yarn_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"part_id": string,"skeins_used"?: number,"updated_at"?: string,"user_id"?: string,"yarn_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"part_id"?: string,"skeins_used"?: number,"updated_at"?: string,"user_id"?: string,"yarn_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "part_yarns_part_id_fkey"
      columns: ["part_id"]
isOneToOne: false
      referencedRelation: "parts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "part_yarns_yarn_id_fkey"
      columns: ["yarn_id"]
isOneToOne: false
      referencedRelation: "yarn_stock"
      referencedColumns: ["yarn_id"]
    },{
      foreignKeyName: "part_yarns_yarn_id_fkey"
      columns: ["yarn_id"]
isOneToOne: false
      referencedRelation: "yarns"
      referencedColumns: ["id"]
    }
                  ]
                },"parts": {
                  Row: {
                    "created_at": string,"current_row": number | null,"done": boolean,"id": string,"name": string,"notes": string | null,"pattern_part_id": string | null,"position": number,"project_id": string,"resume_note": string | null,"total_rows": number | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"current_row"?: number | null,"done"?: boolean,"id"?: string,"name": string,"notes"?: string | null,"pattern_part_id"?: string | null,"position"?: number,"project_id": string,"resume_note"?: string | null,"total_rows"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"current_row"?: number | null,"done"?: boolean,"id"?: string,"name"?: string,"notes"?: string | null,"pattern_part_id"?: string | null,"position"?: number,"project_id"?: string,"resume_note"?: string | null,"total_rows"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "parts_pattern_part_id_fkey"
      columns: ["pattern_part_id"]
isOneToOne: false
      referencedRelation: "pattern_parts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "parts_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_summary"
      referencedColumns: ["project_id"]
    },{
      foreignKeyName: "parts_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"pattern_parts": {
                  Row: {
                    "count": number,"created_at": string,"id": string,"name": string,"pattern_id": string,"position": number,"total_rows": number | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "count"?: number,"created_at"?: string,"id"?: string,"name": string,"pattern_id": string,"position"?: number,"total_rows"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "count"?: number,"created_at"?: string,"id"?: string,"name"?: string,"pattern_id"?: string,"position"?: number,"total_rows"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pattern_parts_pattern_id_fkey"
      columns: ["pattern_id"]
isOneToOne: false
      referencedRelation: "pattern_stats"
      referencedColumns: ["pattern_id"]
    },{
      foreignKeyName: "pattern_parts_pattern_id_fkey"
      columns: ["pattern_id"]
isOneToOne: false
      referencedRelation: "patterns"
      referencedColumns: ["id"]
    }
                  ]
                },"pattern_types": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"position": number,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"position"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"position"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"patterns": {
                  Row: {
                    "created_at": string,"designer": string | null,"hook_size_mm": number | null,"id": string,"name": string,"notes": string | null,"pattern_type_id": string | null,"pdf_path": string | null,"pdf_updated_at": string | null,"photo_path": string | null,"updated_at": string,"url": string | null,"user_id": string,"yarn_weight": Database["public"]['Enums']["yarn_weight"] | null
                  }
                  Insert: {
                    "created_at"?: string,"designer"?: string | null,"hook_size_mm"?: number | null,"id"?: string,"name": string,"notes"?: string | null,"pattern_type_id"?: string | null,"pdf_path"?: string | null,"pdf_updated_at"?: string | null,"photo_path"?: string | null,"updated_at"?: string,"url"?: string | null,"user_id"?: string,"yarn_weight"?: Database["public"]['Enums']["yarn_weight"] | null
                  }
                  Update: {
                    "created_at"?: string,"designer"?: string | null,"hook_size_mm"?: number | null,"id"?: string,"name"?: string,"notes"?: string | null,"pattern_type_id"?: string | null,"pdf_path"?: string | null,"pdf_updated_at"?: string | null,"photo_path"?: string | null,"updated_at"?: string,"url"?: string | null,"user_id"?: string,"yarn_weight"?: Database["public"]['Enums']["yarn_weight"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patterns_pattern_type_id_fkey"
      columns: ["pattern_type_id"]
isOneToOne: false
      referencedRelation: "pattern_types"
      referencedColumns: ["id"]
    }
                  ]
                },"project_photos": {
                  Row: {
                    "caption": string | null,"created_at": string,"id": string,"path": string,"project_id": string,"taken_on": string | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "caption"?: string | null,"created_at"?: string,"id"?: string,"path": string,"project_id": string,"taken_on"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "caption"?: string | null,"created_at"?: string,"id"?: string,"path"?: string,"project_id"?: string,"taken_on"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_photos_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_summary"
      referencedColumns: ["project_id"]
    },{
      foreignKeyName: "project_photos_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"project_yarns": {
                  Row: {
                    "created_at": string,"id": string,"project_id": string,"skeins_planned": number,"updated_at": string,"user_id": string,"yarn_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"project_id": string,"skeins_planned": number,"updated_at"?: string,"user_id"?: string,"yarn_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"project_id"?: string,"skeins_planned"?: number,"updated_at"?: string,"user_id"?: string,"yarn_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_yarns_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_summary"
      referencedColumns: ["project_id"]
    },{
      foreignKeyName: "project_yarns_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_yarns_yarn_id_fkey"
      columns: ["yarn_id"]
isOneToOne: false
      referencedRelation: "yarn_stock"
      referencedColumns: ["yarn_id"]
    },{
      foreignKeyName: "project_yarns_yarn_id_fkey"
      columns: ["yarn_id"]
isOneToOne: false
      referencedRelation: "yarns"
      referencedColumns: ["id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "created_at": string,"finish_date": string | null,"hook_size_mm": number | null,"id": string,"name": string,"notes": string | null,"pattern_id": string | null,"start_date": string | null,"status": Database["public"]['Enums']["project_status"],"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"finish_date"?: string | null,"hook_size_mm"?: number | null,"id"?: string,"name": string,"notes"?: string | null,"pattern_id"?: string | null,"start_date"?: string | null,"status"?: Database["public"]['Enums']["project_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"finish_date"?: string | null,"hook_size_mm"?: number | null,"id"?: string,"name"?: string,"notes"?: string | null,"pattern_id"?: string | null,"start_date"?: string | null,"status"?: Database["public"]['Enums']["project_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_pattern_id_fkey"
      columns: ["pattern_id"]
isOneToOne: false
      referencedRelation: "pattern_stats"
      referencedColumns: ["pattern_id"]
    },{
      foreignKeyName: "projects_pattern_id_fkey"
      columns: ["pattern_id"]
isOneToOne: false
      referencedRelation: "patterns"
      referencedColumns: ["id"]
    }
                  ]
                },"time_sessions": {
                  Row: {
                    "created_at": string,"ended_at": string | null,"id": string,"part_id": string,"started_at": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"ended_at"?: string | null,"id"?: string,"part_id": string,"started_at"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"ended_at"?: string | null,"id"?: string,"part_id"?: string,"started_at"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "time_sessions_part_id_fkey"
      columns: ["part_id"]
isOneToOne: false
      referencedRelation: "parts"
      referencedColumns: ["id"]
    }
                  ]
                },"yarns": {
                  Row: {
                    "bought_at": string | null,"bought_on": string | null,"brand": string | null,"color": string | null,"created_at": string,"fiber": string | null,"id": string,"name": string,"notes": string | null,"photo_path": string | null,"price_per_skein": number | null,"skeins_owned": number,"updated_at": string,"user_id": string,"yarn_weight": Database["public"]['Enums']["yarn_weight"] | null
                  }
                  Insert: {
                    "bought_at"?: string | null,"bought_on"?: string | null,"brand"?: string | null,"color"?: string | null,"created_at"?: string,"fiber"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"photo_path"?: string | null,"price_per_skein"?: number | null,"skeins_owned"?: number,"updated_at"?: string,"user_id"?: string,"yarn_weight"?: Database["public"]['Enums']["yarn_weight"] | null
                  }
                  Update: {
                    "bought_at"?: string | null,"bought_on"?: string | null,"brand"?: string | null,"color"?: string | null,"created_at"?: string,"fiber"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"photo_path"?: string | null,"price_per_skein"?: number | null,"skeins_owned"?: number,"updated_at"?: string,"user_id"?: string,"yarn_weight"?: Database["public"]['Enums']["yarn_weight"] | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "pattern_stats": {
                  Row: {
                    "avg_seconds": number | null,"avg_skeins": number | null,"pattern_id": string | null,"times_made": number | null,"user_id": string | null
                  }
                  Relationships: [
                    
                  ]
                },"project_summary": {
                  Row: {
                    "parts_done": number | null,"parts_total": number | null,"project_id": string | null,"seconds": number | null,"skeins": number | null,"user_id": string | null
                  }
                  Insert: {
                           "parts_done"?: never,"parts_total"?: never,"project_id"?: string | null,"seconds"?: never,"skeins"?: never,"user_id"?: string | null
                         }
                        Update: {
                           "parts_done"?: never,"parts_total"?: never,"project_id"?: string | null,"seconds"?: never,"skeins"?: never,"user_id"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"yarn_stock": {
                  Row: {
                    "free": number | null,"owned": number | null,"reserved": number | null,"used": number | null,"user_id": string | null,"yarn_id": string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "add_skeins":
{ Args: { "p_amount": number,"p_yarn_id": string }; Returns: undefined
                           },
"backfill_part_links":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"start_project_from_pattern":
{ Args: { "p_pattern_id": string }; Returns: string
                           },
"start_timer":
{ Args: { "p_part_id": string }; Returns: {
              "created_at": string,
"ended_at": string | null,
"id": string,
"part_id": string,
"started_at": string,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "time_sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"stop_timer":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           }
          }
          Enums: {
            "project_status": "idea"|"in_progress"|"finished"|"frogged","yarn_weight": "lace"|"fingering"|"sport"|"dk"|"worsted"|"aran"|"bulky"|"super_bulky"|"jumbo"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "project_status": ["idea", "in_progress", "finished", "frogged"],"yarn_weight": ["lace", "fingering", "sport", "dk", "worsted", "aran", "bulky", "super_bulky", "jumbo"]
          }
        }
} as const
