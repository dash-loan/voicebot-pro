// Vapi API client - frontend direct calls
const VAPI_API_KEY = 'f813dae1-0a46-4308-8dee-4ec9a68fecf6';
const VAPI_ASSISTANT_ID = 'aa048f01-d2b0-4a46-828e-121ccc62d691';
const VAPI_PHONE_NUMBER_ID = '042b746b-f5e6-40fa-8830-8137433d5a69';
const VAPI_BASE = 'https://api.vapi.ai';

export { VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID };

export async function vapiCall({ phone, name, assistantId, phoneNumberId }) {
  const response = await fetch(`${VAPI_BASE}/call`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assistantId: assistantId || VAPI_ASSISTANT_ID,
      phoneNumberId: phoneNumberId || VAPI_PHONE_NUMBER_ID,
      customer: {
        number: phone,
        name: name || 'לקוח',
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `שגיאת Vapi: ${response.status}`);
  }

  return data; // { id, status, ... }
}

export async function vapiEndCall(callId) {
  const response = await fetch(`${VAPI_BASE}/call/${callId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` },
  });
  return response.ok;
}

export async function vapiGetCall(callId) {
  const response = await fetch(`${VAPI_BASE}/call/${callId}`, {
    headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` },
  });
  if (!response.ok) return null;
  return response.json();
}

export async function vapiCheckConnection(apiKey, assistantId) {
  const key = apiKey || VAPI_API_KEY;
  const aId = assistantId || VAPI_ASSISTANT_ID;
  const response = await fetch(`${VAPI_BASE}/assistant/${aId}`, {
    headers: { 'Authorization': `Bearer ${key}` },
  });
  if (response.status === 200) {
    const data = await response.json();
    return { connected: true, name: data.name };
  }
  if (response.status === 401) return { connected: false, error: 'API Key שגוי ❌' };
  if (response.status === 404) return { connected: false, error: 'Assistant ID לא נמצא ❌' };
  return { connected: false, error: `שגיאה ${response.status}` };
}