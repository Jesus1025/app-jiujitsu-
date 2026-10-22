// Tipos de la base de datos con el formato de `supabase gen types typescript`.
// Escritos a mano a partir de supabase/migrations; regenerar con `npm run db:types`
// cuando haya un Supabase local corriendo.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type MemberRole = 'owner' | 'instructor' | 'student' | 'guardian';
type MembershipStatus = 'pending' | 'active' | 'rejected' | 'inactive';
type BeltTrack = 'adult' | 'kids';

type AcademyRow = {
  id: string;
  name: string;
  join_code: string;
  logo_path: string | null;
  primary_color: string | null;
  timezone: string;
  currency: string;
  plan: string;
  settings: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type MembershipRow = {
  id: string;
  academy_id: string;
  user_id: string;
  role: MemberRole;
  status: MembershipStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      academies: {
        Row: AcademyRow;
        Insert: Partial<AcademyRow> & { name: string };
        Update: Partial<AcademyRow>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          avatar_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          phone?: string | null;
          avatar_path?: string | null;
        };
        Update: {
          full_name?: string;
          phone?: string | null;
          avatar_path?: string | null;
        };
        Relationships: [];
      };
      memberships: {
        Row: MembershipRow;
        Insert: Partial<MembershipRow> & { academy_id: string; user_id: string; role: MemberRole };
        Update: Partial<MembershipRow>;
        Relationships: [
          {
            foreignKeyName: 'memberships_academy_id_fkey';
            columns: ['academy_id'];
            isOneToOne: false;
            referencedRelation: 'academies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'memberships_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: {
          id: string;
          academy_id: string;
          name: string;
          min_age: number;
          max_age: number | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          academy_id: string;
          name: string;
          min_age: number;
          max_age?: number | null;
          sort_order?: number;
        };
        Update: {
          name?: string;
          min_age?: number;
          max_age?: number | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      belts: {
        Row: {
          id: string;
          academy_id: string;
          track: BeltTrack;
          name: string;
          color_hex: string;
          stripe_color_hex: string | null;
          max_degrees: number;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          academy_id: string;
          track: BeltTrack;
          name: string;
          color_hex: string;
          stripe_color_hex?: string | null;
          max_degrees?: number;
          sort_order: number;
        };
        Update: {
          name?: string;
          color_hex?: string;
          stripe_color_hex?: string | null;
          max_degrees?: number;
          sort_order?: number;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_academy: {
        Args: { p_name: string };
        Returns: AcademyRow;
      };
      join_academy: {
        Args: { p_code: string; p_role?: MemberRole };
        Returns: MembershipRow;
      };
      review_membership: {
        Args: { p_membership: string; p_approve: boolean };
        Returns: MembershipRow;
      };
      regenerate_join_code: {
        Args: { p_academy: string };
        Returns: string;
      };
    };
    Enums: {
      member_role: MemberRole;
      membership_status: MembershipStatus;
      belt_track: BeltTrack;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
