const GATEWAY_URL = 'https://ai-gateway.happycapy.ai/api/v1/chat/completions';
const API_KEY = process.env.AI_GATEWAY_API_KEY ?? '';
const MODEL = 'anthropic/claude-sonnet-4.6';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

async function chat(messages: Message[]): Promise<string> {
  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 4096 }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI Gateway ${res.status}: ${text}`);
  }

  const json = await res.json() as { choices: Array<{ message: { content: string } }> };
  return json.choices[0].message.content;
}

export async function callVision(imageBase64: string, prompt: string): Promise<string> {
  const mimeType = imageBase64.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
  const dataUrl = `data:${mimeType};base64,${imageBase64}`;

  return chat([
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: dataUrl } },
        { type: 'text', text: prompt },
      ],
    },
  ]);
}

export async function callText(systemPrompt: string, userPrompt: string): Promise<string> {
  return chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);
}
