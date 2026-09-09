import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bzldahhdnxbvmoqfwvwq.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_opBVg6JanU97zQKoFMYaqQ_jNOa11sk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
