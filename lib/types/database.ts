// Tipos escritos manualmente a partir de supabase/migrations/0001_init.sql
// (geração automática via `supabase gen types` requer Docker/Podman locais, indisponíveis
// neste ambiente). Ao alterar o schema, atualize este arquivo junto com a migration.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "coach" | "athlete" | "staff";
export type MediaType = "video" | "image";
export type ExerciseVideoStatus = "Pendente" | "Avaliado";
export type MeetingType = "Presencial" | "Videochamada";
export type MeetingStatus = "Agendado" | "Concluído" | "Cancelado";
export type MeetingPurpose = "Treino" | "Específico";
export type SwotCategory = "Força" | "Fraqueza" | "Oportunidade" | "Ameaça";
export type SwotAuthorRole = "coach" | "athlete";
export type SwotItemStatus = "Aberto" | "Concluído";
export type SwotCycleStatus = "Aberto" | "Fechado";
export type ChargeStatus = "Pendente" | "Pago" | "Atrasado" | "Cancelado";
export type DataRequestType = "export" | "deletion";
export type DataRequestStatus = "Pendente" | "Em andamento" | "Concluído";
export type PlayTargetType = "athlete" | "team";
export type AthleteSex = "M" | "F";
export type GameTargetType = "athlete" | "team";
export type GameEventType =
  | "Gol"
  | "Assistência"
  | "Falta"
  | "Cartão amarelo"
  | "Cartão vermelho"
  | "Lesão"
  | "Pênalti sofrido"
  | "Pênalti perdido"
  | "Pênalti defendido"
  | "Escanteio"
  | "Lateral"
  | "Desarme"
  | "Interceptação"
  | "Cruzamento"
  | "Finalização certa"
  | "Finalização errada"
  | "Impedimento"
  | "Defesa"
  | "Passe certo"
  | "Passe errado";
export type GoalType = "Normal" | "Pênalti" | "Cabeça" | "Contra" | "Fora da área";

export interface Database {
  public: {
    Tables: {
      clubs: {
        Row: {
          id: string;
          name: string;
          nutrition_entitlement: boolean;
          storage_quota_bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          nutrition_entitlement?: boolean;
          storage_quota_bytes?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clubs"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          club_id: string;
          role: UserRole;
          full_name: string;
          athlete_id: string | null;
          title: string | null;
          staff_areas: string[];
          created_at: string;
        };
        Insert: {
          id: string;
          club_id: string;
          role: UserRole;
          full_name: string;
          athlete_id?: string | null;
          title?: string | null;
          staff_areas?: string[];
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      athlete_staff_access: {
        Row: {
          id: string;
          club_id: string;
          athlete_id: string;
          staff_profile_id: string;
          access_level: "view" | "manage";
          granted_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          athlete_id: string;
          staff_profile_id: string;
          access_level?: "view" | "manage";
          granted_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["athlete_staff_access"]["Insert"]>;
        Relationships: [];
      };
      athletes: {
        Row: {
          id: string;
          club_id: string;
          full_name: string;
          jersey_num: number | null;
          category: string | null;
          position: string[] | null;
          team: string | null;
          sex: AthleteSex | null;
          birth_date: string | null;
          guardian_name: string | null;
          guardian_phone: string | null;
          athlete_phone: string | null;
          instagram: string | null;
          joined_at: string;
          photo_url: string | null;
          photo_color: string | null;
          height_cm: number | null;
          weight_kg: number | null;
          bmi: number | null;
          current_pain: string | null;
          guardian_consent_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          full_name: string;
          jersey_num?: number | null;
          category?: string | null;
          position?: string[] | null;
          team?: string | null;
          sex?: AthleteSex | null;
          birth_date?: string | null;
          guardian_name?: string | null;
          guardian_phone?: string | null;
          athlete_phone?: string | null;
          instagram?: string | null;
          joined_at?: string;
          photo_url?: string | null;
          photo_color?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          bmi?: number | null;
          current_pain?: string | null;
          guardian_consent_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["athletes"]["Insert"]>;
        Relationships: [];
      };
      mental_notes: {
        Row: {
          id: string;
          athlete_id: string;
          club_id: string;
          author_id: string;
          title: string;
          body: string;
          confidence_score: number | null;
          video_url: string | null;
          entry_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          athlete_id: string;
          club_id: string;
          author_id: string;
          title: string;
          body: string;
          confidence_score?: number | null;
          video_url?: string | null;
          entry_date?: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["mental_notes"]["Insert"]
        >;
        Relationships: [];
      };
      game_reports: {
        Row: {
          id: string;
          athlete_id: string;
          club_id: string;
          author_id: string;
          opponent: string;
          strengths: string | null;
          improve: string | null;
          entry_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          athlete_id: string;
          club_id: string;
          author_id: string;
          opponent: string;
          strengths?: string | null;
          improve?: string | null;
          entry_date?: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["game_reports"]["Insert"]
        >;
        Relationships: [];
      };
      media_items: {
        Row: {
          id: string;
          athlete_id: string;
          club_id: string;
          author_id: string;
          label: string;
          media_type: MediaType;
          storage_path: string | null;
          thumbnail_color: string | null;
          entry_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          athlete_id: string;
          club_id: string;
          author_id: string;
          label: string;
          media_type: MediaType;
          storage_path?: string | null;
          thumbnail_color?: string | null;
          entry_date?: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["media_items"]["Insert"]
        >;
        Relationships: [];
      };
      exercises: {
        Row: {
          id: string;
          athlete_id: string;
          club_id: string;
          prescribed_by: string;
          name: string;
          description: string | null;
          focus: string | null;
          done: boolean;
          scheduled_date: string;
          video_url: string | null;
          swot_item_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          athlete_id: string;
          club_id: string;
          prescribed_by: string;
          name: string;
          description?: string | null;
          focus?: string | null;
          done?: boolean;
          scheduled_date?: string;
          video_url?: string | null;
          swot_item_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["exercises"]["Insert"]>;
        Relationships: [];
      };
      exercise_videos: {
        Row: {
          id: string;
          exercise_id: string;
          athlete_id: string;
          club_id: string;
          storage_path: string;
          label: string | null;
          status: ExerciseVideoStatus;
          coach_comment: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          exercise_id: string;
          athlete_id: string;
          club_id: string;
          storage_path: string;
          label?: string | null;
          status?: ExerciseVideoStatus;
          coach_comment?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          submitted_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["exercise_videos"]["Insert"]
        >;
        Relationships: [];
      };
      diet_items: {
        Row: {
          id: string;
          athlete_id: string;
          club_id: string;
          prescribed_by: string;
          name: string;
          description: string | null;
          done: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          athlete_id: string;
          club_id: string;
          prescribed_by: string;
          name: string;
          description?: string | null;
          done?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["diet_items"]["Insert"]>;
        Relationships: [];
      };
      checkins: {
        Row: {
          id: string;
          athlete_id: string;
          club_id: string;
          fatigue_level: number;
          pain_notes: string | null;
          training_done: boolean;
          diet_done: boolean;
          checkin_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          athlete_id: string;
          club_id: string;
          fatigue_level: number;
          pain_notes?: string | null;
          training_done?: boolean;
          diet_done?: boolean;
          checkin_date?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["checkins"]["Insert"]>;
        Relationships: [];
      };
      meetings: {
        Row: {
          id: string;
          athlete_id: string;
          club_id: string;
          created_by: string;
          title: string;
          meeting_type: MeetingType;
          scheduled_date: string;
          scheduled_time: string;
          notes: string | null;
          status: MeetingStatus;
          athlete_confirmed: boolean;
          batch_id: string | null;
          play_id: string | null;
          material_video_url: string | null;
          purpose: MeetingPurpose;
          swot_item_id: string | null;
          focus_tag: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          athlete_id: string;
          club_id: string;
          created_by: string;
          title: string;
          meeting_type: MeetingType;
          scheduled_date: string;
          scheduled_time: string;
          notes?: string | null;
          status?: MeetingStatus;
          athlete_confirmed?: boolean;
          batch_id?: string | null;
          play_id?: string | null;
          material_video_url?: string | null;
          purpose?: MeetingPurpose;
          swot_item_id?: string | null;
          focus_tag?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["meetings"]["Insert"]>;
        Relationships: [];
      };
      data_requests: {
        Row: {
          id: string;
          athlete_id: string;
          club_id: string;
          requested_by: string;
          request_type: DataRequestType;
          status: DataRequestStatus;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          athlete_id: string;
          club_id: string;
          requested_by: string;
          request_type: DataRequestType;
          status?: DataRequestStatus;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["data_requests"]["Insert"]
        >;
        Relationships: [];
      };
      partner_clubs: {
        Row: {
          id: string;
          club_id: string;
          name: string;
          color_1: string | null;
          color_2: string | null;
          color_3: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          name: string;
          color_1?: string | null;
          color_2?: string | null;
          color_3?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["partner_clubs"]["Insert"]>;
        Relationships: [];
      };
      partner_club_categories: {
        Row: {
          id: string;
          club_id: string;
          partner_club_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          partner_club_id: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["partner_club_categories"]["Insert"]
        >;
        Relationships: [];
      };
      sub_staff_assignments: {
        Row: {
          id: string;
          club_id: string;
          partner_club_category_id: string;
          staff_profile_id: string;
          role_title: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          partner_club_category_id: string;
          staff_profile_id: string;
          role_title: string;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sub_staff_assignments"]["Insert"]>;
        Relationships: [];
      };
      plays: {
        Row: {
          id: string;
          club_id: string;
          created_by: string;
          name: string;
          target_type: PlayTargetType;
          target_athlete_id: string | null;
          target_team: string | null;
          svg_content: string | null;
          frames: Json;
          video_url: string | null;
          description: string | null;
          sport_type: "futsal" | "campo" | "fut7";
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          created_by: string;
          name: string;
          target_type: PlayTargetType;
          target_athlete_id?: string | null;
          target_team?: string | null;
          svg_content?: string | null;
          frames?: Json;
          video_url?: string | null;
          description?: string | null;
          sport_type?: "futsal" | "campo" | "fut7";
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["plays"]["Insert"]>;
        Relationships: [];
      };
      competitions: {
        Row: {
          id: string;
          club_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["competitions"]["Insert"]>;
        Relationships: [];
      };
      games: {
        Row: {
          id: string;
          club_id: string;
          competition_id: string;
          created_by: string;
          opponent: string;
          scheduled_date: string;
          scheduled_time: string | null;
          location: string | null;
          target_type: GameTargetType;
          target_athlete_id: string | null;
          target_team: string | null;
          target_category: string | null;
          notes: string | null;
          our_score: number | null;
          opponent_score: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          competition_id: string;
          created_by: string;
          opponent: string;
          scheduled_date: string;
          scheduled_time?: string | null;
          location?: string | null;
          target_type: GameTargetType;
          target_athlete_id?: string | null;
          target_team?: string | null;
          target_category?: string | null;
          notes?: string | null;
          our_score?: number | null;
          opponent_score?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["games"]["Insert"]>;
        Relationships: [];
      };
      game_events: {
        Row: {
          id: string;
          club_id: string;
          game_id: string;
          athlete_id: string;
          event_type: GameEventType;
          goal_type: GoalType | null;
          minute: number | null;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          game_id: string;
          athlete_id: string;
          event_type: GameEventType;
          goal_type?: GoalType | null;
          minute?: number | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["game_events"]["Insert"]>;
        Relationships: [];
      };
      athlete_club_transfers: {
        Row: {
          id: string;
          athlete_id: string;
          club_id: string;
          from_partner_club_id: string | null;
          from_category: string | null;
          to_partner_club_id: string;
          to_category: string | null;
          transferred_at: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          athlete_id: string;
          club_id: string;
          from_partner_club_id?: string | null;
          from_category?: string | null;
          to_partner_club_id: string;
          to_category?: string | null;
          transferred_at?: string;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["athlete_club_transfers"]["Insert"]
        >;
        Relationships: [];
      };
      athlete_swot_cycles: {
        Row: {
          id: string;
          club_id: string;
          athlete_id: string;
          cycle_number: number;
          status: SwotCycleStatus;
          opened_at: string;
          closed_at: string | null;
          created_by: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          athlete_id: string;
          cycle_number: number;
          status?: SwotCycleStatus;
          opened_at?: string;
          closed_at?: string | null;
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["athlete_swot_cycles"]["Insert"]>;
        Relationships: [];
      };
      athlete_swot_items: {
        Row: {
          id: string;
          cycle_id: string;
          club_id: string;
          athlete_id: string;
          category: SwotCategory;
          author_role: SwotAuthorRole;
          description: string;
          target_meetings: number;
          target_trainings: number;
          meetings_done: number;
          trainings_done: number;
          status: SwotItemStatus;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          cycle_id: string;
          club_id: string;
          athlete_id: string;
          category: SwotCategory;
          author_role: SwotAuthorRole;
          description: string;
          target_meetings?: number;
          target_trainings?: number;
          meetings_done?: number;
          trainings_done?: number;
          status?: SwotItemStatus;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["athlete_swot_items"]["Insert"]>;
        Relationships: [];
      };
      athlete_charges: {
        Row: {
          id: string;
          club_id: string;
          athlete_id: string;
          description: string;
          amount_cents: number;
          competence_month: number;
          competence_year: number;
          due_date: string;
          status: ChargeStatus;
          paid_at: string | null;
          payment_method: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          athlete_id: string;
          description: string;
          amount_cents: number;
          competence_month: number;
          competence_year: number;
          due_date: string;
          status?: ChargeStatus;
          paid_at?: string | null;
          payment_method?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["athlete_charges"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      my_profile: {
        Args: Record<string, never>;
        Returns: { club_id: string; role: UserRole; athlete_id: string | null }[];
      };
    };
    Enums: {
      user_role: UserRole;
    };
    CompositeTypes: Record<string, never>;
  };
}
