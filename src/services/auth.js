import { supabase, hasSupabase } from './supabase.js';

const MOCK_SESSION = { user: { id: 'demo', email: 'demo@copiloto.local' } };

export async function getSession() {
  if (!hasSupabase) return MOCK_SESSION;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signIn(email, senha) {
  if (!hasSupabase) return { session: MOCK_SESSION, error: null };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  return { session: data.session, error };
}

export async function signUp(email, senha) {
  if (!hasSupabase) return { session: MOCK_SESSION, error: null };
  const { data, error } = await supabase.auth.signUp({ email, password: senha });
  return { session: data.session, error };
}

export async function signOut() {
  if (!hasSupabase) return;
  await supabase.auth.signOut();
}

export function onAuthStateChange(callback) {
  if (!hasSupabase) {
    callback('SIGNED_IN', MOCK_SESSION);
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}
