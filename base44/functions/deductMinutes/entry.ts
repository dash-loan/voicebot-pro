import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    // Support both direct calls and entity automation triggers
    const payload = body.data || body; // automation sends { event, data, ... }, direct call sends fields directly
    const { client_id, active_duration_seconds, campaign_id, vapi_cost = 0 } = payload;

    if (!client_id || active_duration_seconds === undefined) {
      return Response.json({ error: 'Missing client_id or active_duration_seconds' }, { status: 400 });
    }

    const minutesUsed = active_duration_seconds / 60;
    const twilioCostPerMin = 0.013;
    const sellPricePerMin = 0.25;
    const totalCost = vapi_cost + (minutesUsed * twilioCostPerMin);
    const revenue = minutesUsed * sellPricePerMin;

    // Find ClientMinutes record
    const records = await base44.asServiceRole.entities.ClientMinutes.filter({ client_id });
    let cm = records[0];

    if (!cm) {
      return Response.json({ error: 'ClientMinutes not found for client' }, { status: 404 });
    }

    const newUsed = (cm.used_minutes || 0) + minutesUsed;
    const newMonthly = (cm.monthly_used_minutes || 0) + minutesUsed;
    const newLifetime = (cm.lifetime_minutes || 0) + minutesUsed;
    const newRemaining = Math.max(0, (cm.total_minutes || 0) - newUsed);

    await base44.asServiceRole.entities.ClientMinutes.update(cm.id, {
      used_minutes: newUsed,
      monthly_used_minutes: newMonthly,
      lifetime_minutes: newLifetime,
      remaining_minutes: newRemaining
    });

    // Create transaction log
    await base44.asServiceRole.entities.MinutesTransaction.create({
      client_id,
      amount: minutesUsed,
      type: 'deduct',
      description: `שיחה ${active_duration_seconds}s${campaign_id ? ` | קמפיין ${campaign_id.slice(0, 8)}` : ''} | עלות $${totalCost.toFixed(3)} | הכנסה $${revenue.toFixed(3)}`
    });

    // If out of minutes – pause all active campaigns
    if (newRemaining <= 0) {
      const campaigns = await base44.asServiceRole.entities.Campaign.filter({ client_id, status: 'active' });
      for (const c of campaigns) {
        await base44.asServiceRole.entities.Campaign.update(c.id, { status: 'paused' });
      }
      return Response.json({ ok: true, remaining: 0, paused_campaigns: campaigns.length, warning: 'out_of_minutes' });
    }

    return Response.json({ ok: true, remaining: newRemaining, used: newUsed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});