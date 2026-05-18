import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;

export const hasSupabase = Boolean(supabase);

export async function testarConexao() {
  if (!supabase) return;
  try {
    await supabase.auth.getSession();
    console.log('[Supabase] Conexão OK');
  } catch (err) {
    console.log('[Supabase] Erro:', err.message);
  }
}
