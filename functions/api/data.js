// functions/api/data.js
// Endpoint GET/POST pentru starea comună a aplicației, salvată în Cloudflare KV.
// Necesită un KV namespace legat cu binding-ul "BABY_KV" (vezi README.md).

const DEFAULT_STATE = {
  version: 1,
  babies: [
    { id: 'a', name: 'Bebe A', color: '#8FB49C' },
    { id: 'b', name: 'Bebe B', color: '#D98A96' },
  ],
  logs: { feeding: [], sleep: [], diaper: [], growth: [], activity: [] },
  timers: { feeding: {}, sleep: {} },
  updatedAt: 0,
};

export async function onRequestGet(context) {
  try {
    const raw = await context.env.BABY_KV.get('state');
    const body = raw || JSON.stringify(DEFAULT_STATE);
    return new Response(body, {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'kv_not_configured', message: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export async function onRequestPost(context) {
  try {
    const text = await context.request.text();
    // validare minimă
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') throw new Error('invalid body');
    await context.env.BABY_KV.put('state', text);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'save_failed', message: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
