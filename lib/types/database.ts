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

export type UserRole = "coach" | "athlete";
export type MediaType = "video" | "image";
export type ExerciseVideoStatus = "Pendente" | "Avaliado";
export type MeetingType = "Presencial" | "Videochamada";
export type MeetingStatus = "Agendado" | "Concluído" | "Cancelado";
export type DataRequestType = "export" | "deletion";
export type DataRequestStatus = "Pendente" | "Em andamento" | "Concluído";
export type PlayTargetType = "athlete" | "team";

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
          created_at: string;
        };
        Insert: {
          id: string;
          club_id: string;
          role: UserRole;
          full_name: string;
          athlete_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      athletes: {
        Row: {
          id: string;
          club_id: string;
          full_name: string;
          jersey_num: number | null;
          category: string | null;
          position: string | null;
          team: string | null;
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
          position?: string | null;
          team?: string | null;
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
      categories: {
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
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
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
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["plays"]["Insert"]>;
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
