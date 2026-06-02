import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'גישת מנהל נדרשת' }, { status: 403 });
    }

    const { twilioPhoneSid, assignedClientId } = await req.json();
    if (!twilioPhoneSid || !twilioPhoneSid.startsWith('PN')) {
      return Response.json({ error: 'Twilio Phone SID חייב להתחיל ב-PN...' }, { status: 400 });
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    if (!accountSid || !authToken) {
      return Response.json({ error: 'Twilio credentials לא מוגדרים' }, { status: 500 });
    }

    // Step 1: Verify number exists in Twilio
    const twilioResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${twilioPhoneSid}.json`,
      { headers: { 'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`) } }
    );

    if (!twilioResp.ok) {
      const err = await twilioResp.json().catch(() => ({}));
      return Response.json({ error: `Twilio אימות נכשל: ${err.message || `סטטוס ${twilioResp.status}`}` }, { status: 400 });
    }

    const twilioNumber = await twilioResp.json();
    const phoneNumber = twilioNumber.phone_number;

    // Check not already registered
    const existing = await base44.asServiceRole.entities.VirtualNumber.filter({ phone_number: phoneNumber });
    if (existing.length > 0) {
      return Response.json({ error: `המספר ${phoneNumber} כבר רשום במערכת` }, { status: 409 });
    }

    // Step 2: Register with Vapi
    const configs = await base44.asServiceRole.entities.VapiConfig.list();
    const vapiApiKey = configs[0]?.vapi_api_key;
    if (!vapiApiKey) {
      return Response.json({ error: 'Vapi API Key לא מוגדר בהגדרות המערכת' }, { status: 400 });
    }

    const vapiResp = await fetch('https://api.vapi.ai/phone-number', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'twilio',
        number: phoneNumber,
        twilioAccountSid: accountSid,
        twilioAuthToken: authToken,
        name: twilioNumber.friendly_name || phoneNumber,
      }),
    });

    const vapiData = await vapiResp.json();
    if (!vapiResp.ok) {
      return Response.json({ error: `Vapi רישום נכשל: ${vapiData.message || vapiData.error || vapiResp.status}` }, { status: 400 });
    }

    // Step 3: Save to VirtualNumber entity
    const virtualNumber = await base44.asServiceRole.entities.VirtualNumber.create({
      phone_number: phoneNumber,
      vapi_phone_number_id: vapiData.id,
      provider: 'Twilio',
      status: 'active',
      assigned_client_id: assignedClientId || null,
    });

    return Response.json({
      success: true,
      phone_number: phoneNumber,
      vapi_phone_number_id: vapiData.id,
      virtualNumber,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});