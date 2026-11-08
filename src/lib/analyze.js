import { supabase } from './supabase';

// Item recognition result. confidence: 0..1. demo: true when the answer is not real.
// Without Supabase we return a clearly marked demo answer so the screen can be tested.
export async function analyzeItem({ base64, mimeType = 'image/jpeg' }) {
  if (!supabase) {
    await new Promise((r) => setTimeout(r, 900));
    return { demo: true, brand: 'Rick Owens', collection: 'Geobasket', season: 'FW08', slot: 'outer', colors: ['olive', 'grey'], confidence: 0.42,
      note: 'Demo answer: Supabase is not connected, no recognition was run.' };
  }
  // There is no sign-in screen yet, so we use Supabase anonymous sign-in (enable: Authentication → Sign In / Providers → Anonymous).
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) {
    const { error: authError } = await supabase.auth.signInAnonymously();
    if (authError) throw new Error('Could not sign in. Please try again later.');
  }
  const { data, error } = await supabase.functions.invoke('analyze-item', { body: { image: base64, mimeType } });
  if (error) {
    const status = error.context?.status;
    if (status === 429) return { limit: true };
    throw new Error('Could not recognise the piece. Please try again.');
  }
  return { demo: false, ...data };
}
