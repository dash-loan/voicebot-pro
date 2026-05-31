import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { api_key, assistant_id } = await req.json();
    if (!api_key) return Response.json({ error: 'API Key נדרש' }, { status: 400 });
    if (!assistant_id) return Response.json({ error: 'Assistant ID נדרש' }, { status: 400 });

    const resp = await fetch(`https://api.vapi.ai/assistant/${assistant_id}`, {
      headers: { 'Authorization': `Bearer ${api_key}` },
    });

    if (resp.status === 200) {
      const data = await resp.json();
      return Response.json({ connected: true, assistant_name: data.name || assistant_id });
    } else if (resp.status === 401) {
      return Response.json({ connected: false, error: 'API Key שגוי ❌' });
    } else if (resp.status === 404) {
      return Response.json({ connected: false, error: 'Assistant ID לא נמצא ❌' });
    } else {
      return Response.json({ connected: false, error: `שגיאה ${resp.status}` });
    }

  } catch (error) {
    return Response.json({ connected: false, error: error.message }, { status: 500 });
  }
});