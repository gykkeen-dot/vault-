import { supabase } from './supabase';

// Результат распознавания вещи. confidence: 0..1. demo: true, если ответ не настоящий.
// Без подключённого Supabase возвращаем явно помеченный демо-ответ, чтобы экран можно было проверить.
export async function analyzeItem({ base64, mimeType = 'image/jpeg' }) {
  if (!supabase) {
    await new Promise((r) => setTimeout(r, 900));
    return { demo: true, brand: 'Rick Owens', collection: 'Geobasket', season: 'FW08', confidence: 0.42,
      note: 'Демо-ответ: Supabase не подключён, распознавание не выполнялось.' };
  }
  // Пока нет экрана входа, используем анонимный вход Supabase (включить: Authentication → Sign In / Providers → Anonymous).
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) {
    const { error: authError } = await supabase.auth.signInAnonymously();
    if (authError) throw new Error('Не удалось войти. Попробуй позже.');
  }
  const { data, error } = await supabase.functions.invoke('analyze-item', { body: { image: base64, mimeType } });
  if (error) {
    const status = error.context?.status;
    if (status === 429) return { limit: true };
    throw new Error('Не удалось распознать вещь. Попробуй ещё раз.');
  }
  return { demo: false, ...data };
}
