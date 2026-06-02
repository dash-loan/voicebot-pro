import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { campaign_id } = await req.json();
    if (!campaign_id) return Response.json({ error: 'campaign_id נדרש' }, { status: 400 });

    // Load campaign
    const campaign = await base44.asServiceRole.entities.Campaign.get(campaign_id);
    if (!campaign) return Response.json({ error: 'קמפיין לא נמצא' }, { status: 404 });

    // Load VapiConfig (admin only)
    const configs = await base44.asServiceRole.entities.VapiConfig.list();
    const config = configs[0];
    if (!config?.vapi_api_key) return Response.json({ error: 'Vapi API Key לא מוגדר' }, { status: 400 });

    // Use campaign's assigned virtual number's vapi_phone_number_id
    let phoneNumberId = config.vapi_phone_number_id;
    if (campaign.virtual_number_id) {
      const vn = await base44.asServiceRole.entities.VirtualNumber.get(campaign.virtual_number_id);
      if (vn?.vapi_phone_number_id) phoneNumberId = vn.vapi_phone_number_id;
    }
    if (!phoneNumberId) return Response.json({ error: 'Phone Number ID לא מוגדר — שייך מספר וירטואלי לקמפיין' }, { status: 400 });

    // Check client minutes
    const minutesList2 = await base44.asServiceRole.entities.ClientMinutes.filter({ client_id: campaign.client_id });
    const cm = minutesList2[0];
    if (!cm || (cm.remaining_minutes || 0) <= 0) {
      return Response.json({ error: 'אין דקות זמינות — יש לצור קשר עם מנהל התיק לרכישת דקות נוספות', frozen: true }, { status: 402 });
    }

    // Determine assistant ID (use campaign override or default Hebrew)
    const assistantId = campaign.vapi_assistant_id || config.vapi_assistant_id;
    if (!assistantId) return Response.json({ error: 'Vapi Assistant ID לא מוגדר' }, { status: 400 });

    // Check client minutes
    const minutesList = await base44.asServiceRole.entities.ClientMinutes.filter({ client_id: campaign.client_id });
    const clientMinutes = minutesList[0];
    if (!clientMinutes || clientMinutes.remaining_minutes <= 0) {
      return Response.json({ error: 'אין מספיק דקות בבנק הלקוח' }, { status: 400 });
    }

    // Check dialing hours
    const now = new Date();
    const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const currentHour = israelTime.getHours();
    const currentMin = israelTime.getMinutes();
    const currentTotal = currentHour * 60 + currentMin;

    const [startH, startM] = (campaign.dialing_start || '09:00').split(':').map(Number);
    const [endH, endM] = (campaign.dialing_end || '20:00').split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    if (currentTotal < startTotal || currentTotal > endTotal) {
      return Response.json({ error: `מחוץ לשעות חיוג (${campaign.dialing_start}–${campaign.dialing_end})` }, { status: 400 });
    }

    // Load pending contacts
    const allContacts = await base44.asServiceRole.entities.Contact.filter({ campaign_id, status: 'pending' });
    if (allContacts.length === 0) return Response.json({ error: 'אין אנשי קשר ממתינים' }, { status: 400 });

    // Respect max_concurrent
    const maxConcurrent = campaign.max_concurrent || 5;
    const batch = allContacts.slice(0, maxConcurrent);

    let dialedCount = 0;
    const errors = [];

    for (const contact of batch) {
      try {
        const vapiResp = await fetch('https://api.vapi.ai/call', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.vapi_api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assistantId,
            phoneNumberId: config.vapi_phone_number_id,
            customer: {
              number: contact.phone,
              name: contact.name,
            },
            assistantOverrides: {
              variableValues: {
                customerName: contact.name,
              },
            },
          }),
        });

        const vapiData = await vapiResp.json();

        if (!vapiResp.ok) {
          errors.push({ phone: contact.phone, error: vapiData.message || vapiResp.status });
          continue;
        }

        // Save vapi call id and update status
        await base44.asServiceRole.entities.Contact.update(contact.id, {
          status: 'calling',
          attempts: (contact.attempts || 0) + 1,
          last_attempt: new Date().toISOString(),
          notes: vapiData.id, // store vapi call id in notes temporarily
        });

        // Log the event
        await base44.asServiceRole.entities.VapiWebhookEvents.create({
          campaign_id,
          client_id: campaign.client_id,
          call_id: vapiData.id,
          event: 'call.started',
          phone_number: contact.phone,
          received_at: new Date().toISOString(),
          payload: JSON.stringify({ contact_id: contact.id, vapi_call_id: vapiData.id }),
        });

        dialedCount++;
      } catch (err) {
        errors.push({ phone: contact.phone, error: err.message });
      }
    }

    // Update campaign counters
    await base44.asServiceRole.entities.Campaign.update(campaign_id, {
      status: 'active',
      dialed_contacts: (campaign.dialed_contacts || 0) + dialedCount,
    });

    return Response.json({
      success: true,
      dialed: dialedCount,
      errors,
      message: `חויגו ${dialedCount} מספרים בהצלחה`,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});