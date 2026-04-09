import { getCredential } from "../credentials.js";

const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

// Cost per 1M tokens (USD) — approximate, covers common models
const MODEL_COSTS: Record<string, { prompt: number; completion: number }> = {
  "anthropic/claude-sonnet-4": { prompt: 3.0, completion: 15.0 },
  "anthropic/claude-haiku-4-5": { prompt: 0.8, completion: 4.0 },
  "anthropic/claude-opus-4": { prompt: 15.0, completion: 75.0 },
  "openai/gpt-4o": { prompt: 5.0, completion: 15.0 },
  "openai/gpt-4o-mini": { prompt: 0.15, completion: 0.6 },
  "meta-llama/llama-3.1-8b-instruct": { prompt: 0.06, completion: 0.06 },
};

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const costs = MODEL_COSTS[model] ?? { prompt: 1.0, completion: 5.0 };
  return (promptTokens / 1_000_000) * costs.prompt + (completionTokens / 1_000_000) * costs.completion;
}

export async function callOpenRouter(options: {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  stream?: boolean;
  onChunk?: (text: string) => void;
}): Promise<{ content: string; usage: { prompt_tokens: number; completion_tokens: number } }> {
  const { messages, model = DEFAULT_MODEL, stream = false, onChunk } = options;

  const apiKey = await getCredential("openrouter");
  if (!apiKey) {
    throw new Error("OpenRouter API key not configured. Run the onboarding wizard.");
  }

  const response = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "LINK'DUP",
    },
    body: JSON.stringify({ model, messages, stream }),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("Invalid API key");
    if (response.status === 429) throw new Error("Rate limited — too many requests");
    let errMsg = `API error ${response.status}`;
    try {
      const errBody = await response.json() as { error?: { message?: string } };
      if (errBody?.error?.message) errMsg = errBody.error.message;
    } catch {}
    throw new Error(errMsg);
  }

  if (!stream) {
    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number };
    };
    return {
      content: data.choices[0].message.content,
      usage: data.usage,
    };
  }

  // Streaming mode — read SSE line by line
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body for streaming");

  const decoder = new TextDecoder();
  let fullContent = "";
  let promptTokens = 0;
  let completionTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
          usage?: { prompt_tokens: number; completion_tokens: number };
        };

        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          if (onChunk) onChunk(delta);
        }

        if (parsed.usage) {
          promptTokens = parsed.usage.prompt_tokens;
          completionTokens = parsed.usage.completion_tokens;
        }
      } catch {}
    }
  }

  return {
    content: fullContent,
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
  };
}
