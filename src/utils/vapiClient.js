/**
 * Vapi API Client
 * All Vapi API calls are centralized here.
 * apiKey must be passed from the caller (loaded from VapiConfig entity).
 * This makes migration to a private server straightforward.
 */

const VAPI_BASE = 'https://api.vapi.ai';

async function vapiRequest({ apiKey, method, path, body }) {
  const response = await fetch(`${VAPI_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `שגיאת Vapi ${response.status}: ${path}`);
  }
  return data;
}

/** Create an outbound call */
export async function vapiCall({ apiKey, phone, name, assistantId, phoneNumberId }) {
  return vapiRequest({
    apiKey,
    method: 'POST',
    path: '/call',
    body: {
      assistantId,
      phoneNumberId,
      customer: { number: phone, name: name || 'לקוח' },
    },
  });
}

/** End (delete) an active call */
export async function vapiEndCall({ apiKey, callId }) {
  const response = await fetch(`${VAPI_BASE}/call/${callId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  return response.ok;
}

/** Get call details */
export async function vapiGetCall({ apiKey, callId }) {
  return vapiRequest({ apiKey, method: 'GET', path: `/call/${callId}` });
}

/** Check connection validity */
export async function vapiCheckConnection({ apiKey, assistantId }) {
  try {
    const data = await vapiRequest({ apiKey, method: 'GET', path: `/assistant/${assistantId}` });
    return { connected: true, name: data.name };
  } catch (e) {
    if (e.message.includes('401')) return { connected: false, error: 'API Key שגוי ❌' };
    if (e.message.includes('404')) return { connected: false, error: 'Assistant ID לא נמצא ❌' };
    return { connected: false, error: e.message };
  }
}

/** Create a new Vapi Assistant from a script */
export async function vapiCreateAssistant({ apiKey, name, systemPrompt, firstMessage, language }) {
  const deepgramLang = language === 'ar' ? 'ar' : 'he';
  return vapiRequest({
    apiKey,
    method: 'POST',
    path: '/assistant',
    body: {
      name,
      model: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        messages: [{ role: 'system', content: systemPrompt }],
      },
      voice: {
        provider: '11labs',
        voiceId: language === 'ar' ? 'Arabic_Voice' : 'Elliot',
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-3',
        language: deepgramLang,
      },
      firstMessage: firstMessage || '',
    },
  });
}

/** Update an existing Vapi Assistant */
export async function vapiUpdateAssistant({ apiKey, assistantId, name, systemPrompt, firstMessage, language }) {
  const deepgramLang = language === 'ar' ? 'ar' : 'he';
  return vapiRequest({
    apiKey,
    method: 'PATCH',
    path: `/assistant/${assistantId}`,
    body: {
      name,
      model: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        messages: [{ role: 'system', content: systemPrompt }],
      },
      voice: {
        provider: '11labs',
        voiceId: language === 'ar' ? 'Arabic_Voice' : 'Elliot',
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-3',
        language: deepgramLang,
      },
      firstMessage: firstMessage || '',
    },
  });
}

/** Delete a Vapi Assistant */
export async function vapiDeleteAssistant({ apiKey, assistantId }) {
  const response = await fetch(`${VAPI_BASE}/assistant/${assistantId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  return response.ok;
}