
// src/lib/supabase.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Client-side supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side supabase client with service role (for admin operations)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Database types based on your actual schema
export interface Database {
  public: {
    Tables: {
      all_cases: {
        Row: {
          id: number;
          date: string | null;
          month: string | null;
          ticket_number: string | null;
          client_name: string | null;
          pic_client: string | null;
          status_case: string | null;
          category_case: string | null;
          module_case: string | null;
          detail_module: string | null;
          check_in: string | null;
          detail_case: string | null;
          check_out: string | null;
          status_case_solved: string | null;
          source_link_op: string | null;
          note: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: number;
          date?: string | null;
          month?: string | null;
          ticket_number?: string | null;
          client_name?: string | null;
          pic_client?: string | null;
          status_case?: string | null;
          category_case?: string | null;
          module_case?: string | null;
          detail_module?: string | null;
          check_in?: string | null;
          detail_case?: string | null;
          check_out?: string | null;
          status_case_solved?: string | null;
          source_link_op?: string | null;
          note?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: number;
          date?: string | null;
          month?: string | null;
          ticket_number?: string | null;
          client_name?: string | null;
          pic_client?: string | null;
          status_case?: string | null;
          category_case?: string | null;
          module_case?: string | null;
          detail_module?: string | null;
          check_in?: string | null;
          detail_case?: string | null;
          check_out?: string | null;
          status_case_solved?: string | null;
          source_link_op?: string | null;
          note?: string | null;
          deleted_at?: string | null;
        };
      };
    };
  };
}
