import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Map endedReason → contact status
function getContactStatus(endedReason, transcript) {
  if (!endedReason) return 'answered';
  if (endedReason === 'voicemail') return 'voicemail';
  if (endedReason === 'no-answer' || endedReason === 'no_answer') return 'no_answer';

  // For answered calls, try to detect interest from transcript
  if (transcript) {
    const lower = transcript.toLowerCase();
    const interestedWords = ['כן', 'בטח', 'מעניין', 'אשמח', 'רוצה', 'בבקשה', 'אני רוצה', 'נשמע טוב'];
    const notInterestedWords = ['לא', 'לא מעוניין', 'לא רוצה', 'לא תודה', 'לא עכשיו'];
    const hasInterested = interestedWords.some(w => lower.includes(w));
    const hasNotInterested = notInterestedWords.some(w => lower.includes(w));
    if (hasInterested && !hasNotInterested) return 'interested';
    if (hasNotInterested) return 'not_interested';
  }
  return 'answered';
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const eventType = body.message?.type || body.type;
    const callData = body.message?.call || body.call || {};
    const vapiCallId = callData.id || body.call?.id;

    // Only process call-ended events fully; log everything
    await base44.asServiceRole.entities.VapiWebhookEvents.create({
      event: eventType === 'end-of-call-report' ? 'call.ended' : eventType === 'call-started' ? 'call.started' : 'call.ended',
      call_id: vapiCallId || 'unknown',
      received_at: new Date().toISOString(),
      payload: JSON.stringify(body),
    }).catch(() => {}); // non-blocking

    // Only process end-of-call-report (the main completion event from Vapi)
    if (eventType !== 'end-of-call-report' && eventType !== 'call-ended') {
      return Response.json({ received: true });
    }

    if (!vapiCallId) return Response.json({ received: true, warning: 'no call id' });

    // Find contact by vapi call id stored in notes
    const contacts = await base44.asServiceRole.entities.Contact.filter({ notes: vapiCallId });
    const contact = contacts[0];

    if (!contact) {
      return Response.json({ received: true, warning: 'contact not found for call ' + vapiCallId });
    }

    const endedReason = callData.endedReason || callData.ended_reason || '';
    const transcript = callData.transcript || body.message?.transcript || '';
    const messages = callData.messages || body.message?.messages || [];
    const durationSeconds = callData.duration || 0;
    const vapiCost = callData.cost || 0;
    const activeDuration = Math.max(0, durationSeconds - 5); // subtract ~5s ring time

    const contactStatus = getContactStatus(endedReason, transcript);

    // Load campaign to get client_id
    const campaign = await base44.asServiceRole.entities.Campaign.get(contact.campaign_id);
    if (!campaign) return Response.json({ received: true, warning: 'campaign not found' });

    // Update contact
    await base44.asServiceRole.entities.Contact.update(contact.id, {
      status: contactStatus,
      duration: activeDuration,
      last_attempt: new Date().toISOString(),
    });

    // Save CallLog
    await base44.asServiceRole.entities.CallLog.create({
      contact_id: contact.id,
      campaign_id: contact.campaign_id,
      client_id: campaign.client_id,
      contact_name: contact.name,
      contact_phone: contact.phone,
      campaign_name: campaign.name,
      start_time: callData.startedAt || new Date().toISOString(),
      end_time: callData.endedAt || new Date().toISOString(),
      duration: durationSeconds,
      active_duration_seconds: activeDuration,
      status: contactStatus,
      vapi_call_id: vapiCallId,
      vapi_cost: vapiCost,
      ended_reason: endedReason,
      transcript,
      transcript_json: messages.length > 0 ? JSON.stringify(messages) : null,
    });

    // Update campaign counters
    const allContacts = await base44.asServiceRole.entities.Contact.filter({ campaign_id: contact.campaign_id });
    const dialed = allContacts.filter(c => c.status !== 'pending' && c.status !== 'calling').length;
    const answered = allContacts.filter(c => ['answered', 'interested', 'not_interested'].includes(c.status)).length;
    const stillCalling = allContacts.filter(c => c.status === 'calling').length;

    await base44.asServiceRole.entities.Campaign.update(contact.campaign_id, {
      dialed_contacts: dialed,
      answered_contacts: answered,
      actual_minutes: (campaign.actual_minutes || 0) + activeDuration / 60,
      ...(stillCalling === 0 && dialed >= (campaign.total_contacts || 0) ? { status: 'completed' } : {}),
    });

    // Deduct minutes from client
    if (activeDuration > 0) {
      const minutesList = await base44.asServiceRole.entities.ClientMinutes.filter({ client_id: campaign.client_id });
      const clientMinutes = minutesList[0];
      if (clientMinutes) {
        const deductMins = activeDuration / 60;
        const newRemaining = Math.max(0, (clientMinutes.remaining_minutes || 0) - deductMins);
        const newUsed = (clientMinutes.used_minutes || 0) + deductMins;

        await base44.asServiceRole.entities.ClientMinutes.update(clientMinutes.id, {
          used_minutes: newUsed,
          remaining_minutes: newRemaining,
          monthly_used_minutes: (clientMinutes.monthly_used_minutes || 0) + deductMins,
        });

        await base44.asServiceRole.entities.MinutesTransaction.create({
          client_id: campaign.client_id,
          amount: deductMins,
          type: 'deduct',
          description: `שיחה עם ${contact.name} – קמפיין ${campaign.name}`,
        });

        // If minutes exhausted → pause campaign
        if (newRemaining <= 0 && stillCalling === 0) {
          await base44.asServiceRole.entities.Campaign.update(contact.campaign_id, { status: 'paused' });
        }
      }
    }

    return Response.json({ received: true, status: contactStatus });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});