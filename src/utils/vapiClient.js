/**
 * Vapi API Client
 * All Vapi API calls are centralized here.
 *
 * Key rule:
 *   Frontend (/call, /call DELETE) → publicKey (vapi_public_key from VapiConfig)
 *   Admin/Backend (create/update assistant) → apiKey (vapi_api_key, private)
 *
 * Migration note: replace VAPI_BASE and swap fetch() for your server's proxy to move off Base44.
 */

const VAPI_BASE = 'https://api.vapi.ai';

async function vapiRequest({ key, method, path, body }) {
  const response = await fetch(`${VAPI_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${key}`,
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

/**
 * Create an outbound call.
 * Uses publicKey — safe for frontend/browser.
 */
export async function vapiCall({ publicKey, phone, name, assistantId, phoneNumberId }) {
  return vapiRequest({
    key: publicKey,
    method: 'POST',
    path: '/call',
    body: {
      assistantId,
      phoneNumberId,
      customer: { number: phone, name: name || 'לקוח' },
    },
  });
}

/**
 * End (delete) an active call.
 * Uses publicKey — safe for frontend/browser.
 */
export async function vapiEndCall({ publicKey, callId }) {
  const response = await fetch(`${VAPI_BASE}/call/${callId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${publicKey}` },
  });
  return response.ok;
}

/**
 * Get call details.
 * Uses private apiKey — admin only.
 */
export async function vapiGetCall({ apiKey, callId }) {
  return vapiRequest({ key: apiKey, method: 'GET', path: `/call/${callId}` });
}

/**
 * Check connection validity.
 * Uses private apiKey — admin only.
 */
export async function vapiCheckConnection({ apiKey, assistantId }) {
  try {
    const data = await vapiRequest({ key: apiKey, method: 'GET', path: `/assistant/${assistantId}` });
    return { connected: true, name: data.name };
  } catch (e) {
    if (e.message.includes('401')) return { connected: false, error: 'API Key שגוי ❌' };
    if (e.message.includes('404')) return { connected: false, error: 'Assistant ID לא נמצא ❌' };
    return { connected: false, error: e.message };
  }
}

/**
 * Create a new Vapi Assistant from a script.
 * Uses private apiKey — admin only.
 */
export async function vapiCreateAssistant({ apiKey, name, systemPrompt, firstMessage }) {
  return vapiRequest({
    key: apiKey,
    method: 'POST',
    path: '/assistant',
    body: {
      name,
      model: {
        provider: 'anthropic-bedrock',
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'system', content: systemPrompt }],
      },
      voice: {
        provider: 'vapi',
        voiceId: 'Elliot',
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-3',
        language: 'he',
      },
      firstMessage: firstMessage || '',
    },
  });
}

/**
 * Update an existing Vapi Assistant.
 * Uses private apiKey — admin only.
 */
export async function vapiUpdateAssistant({ apiKey, assistantId, name, systemPrompt, firstMessage }) {
  return vapiRequest({
    key: apiKey,
    method: 'PATCH',
    path: `/assistant/${assistantId}`,
    body: {
      name,
      model: {
        provider: 'anthropic-bedrock',
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'system', content: systemPrompt }],
      },
      voice: {
        provider: 'vapi',
        voiceId: 'Elliot',
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-3',
        language: 'he',
      },
      firstMessage: firstMessage || '',
    },
  });
}

/**
 * List all Vapi Assistants.
 * Uses private apiKey — admin only.
 */
export async function vapiListAssistants({ apiKey }) {
  return vapiRequest({ key: apiKey, method: 'GET', path: '/assistant?limit=100' });
}

/**
 * Delete a Vapi Assistant.
 * Uses private apiKey — admin only.
 */
export async function vapiDeleteAssistant({ apiKey, assistantId }) {
  const response = await fetch(`${VAPI_BASE}/assistant/${assistantId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  return response.ok;
}