
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[supabaseClient] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set. ' +
      'Auth features will not work. Copy .env.example to .env and fill in your values.',
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
