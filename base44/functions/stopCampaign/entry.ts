import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { campaign_id } = await req.json();
    if (!campaign_id) return Response.json({ error: 'campaign_id נדרש' }, { status: 400 });

    const configs = await base44.asServiceRole.entities.VapiConfig.list();
    const config = configs[0];

    // Find all calling contacts to cancel their calls
    const callingContacts = await base44.asServiceRole.entities.Contact.filter({ campaign_id, status: 'calling' });

    let cancelled = 0;
    for (const contact of callingContacts) {
      const vapiCallId = contact.notes; // stored in notes field
      if (vapiCallId && config?.vapi_api_key) {
        try {
          await fetch(`https://api.vapi.ai/call/${vapiCallId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${config.vapi_api_key}` },
          });
          cancelled++;
        } catch (_) { /* ignore */ }
      }

      // Reset calling contacts back to pending
      await base44.asServiceRole.entities.Contact.update(contact.id, { status: 'pending' });
    }

    await base44.asServiceRole.entities.Campaign.update(campaign_id, { status: 'paused' });

    return Response.json({ success: true, cancelled, message: `קמפיין הושהה. ${cancelled} שיחות בוטלו.` });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});