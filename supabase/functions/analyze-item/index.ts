// Edge Function: identifies brand, collection and season from a photo. NOT DEPLOYED AND NOT TESTED.
// Before deploying: supabase secrets set ANTHROPIC_API_KEY=... ; supabase functions deploy analyze-item
// JWT verification is on by default, unauthenticated calls are rejected.
import { createClient } from 'npm:@supabase/supabase-js@2';

const FREE_DAILY_LIMIT = 5;
const MODEL = Deno.env.get('ANALYZE_MODEL') ?? 'claude-sonnet-5-5';
const MAX_IMAGE_CHARS = 7_000_000; // ~5 MB in base64

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return json({ error: 'unauthorized' }, 401);

  const { image, mimeType } = await req.json().catch(() => ({}));
  if (typeof image !== 'string' || image.length > MAX_IMAGE_CHARS) return json({ error: 'bad_image' }, 400);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return json({ error: 'bad_type' }, 400);

  // The limit is enforced on the server: plan is read from profiles, the counter only grows through consume_usage.
  const { data: prof } = await supabase.from('profiles').select('plan').eq('id', u.user.id).single();
  if (prof?.plan !== 'premium') {
    const { data: count, error } = await supabase.rpc('consume_usage', { p_feature: 'outfit' });
    if (error) return json({ error: 'usage' }, 500);
    if ((count as number) > FREE_DAILY_LIMIT) return json({ error: 'limit' }, 429);
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: 'You identify high-fashion pieces from photos. Reply with JSON only: {"brand":string|null,"collection":string|null,"season":string|null,"slot":"top"|"bottom"|"outer"|"shoes"|"bag"|"accessory"|null,"colors":string[],"confidence":number 0..1}. If unsure, use null and a low confidence. Do not invent.',
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: image } },
        { type: 'text', text: 'Identify the brand, collection and season (for example FW08).' },
      ] }],
    }),
  });
  if (!res.ok) return json({ error: 'upstream' }, 502);
  const out = await res.json();
  try {
    const text = out.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '';
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    return json({
      brand: parsed.brand ?? null, collection: parsed.collection ?? null, season: parsed.season ?? null,
      slot: parsed.slot ?? null, colors: Array.isArray(parsed.colors) ? parsed.colors.slice(0, 4).map(String) : [],
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
    });
  } catch {
    return json({ error: 'parse' }, 502);
  }
});
