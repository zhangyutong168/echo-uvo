// LLM provider abstraction. Any OpenAI-compatible endpoint works:
// Zhipu GLM, DeepSeek, Moonshot, OpenAI, local gateways, etc.
// Key resolution order: server env var -> user-supplied BYOK (localStorage).
// With no key at all, callers fall back to deterministic heuristics.

export interface ProviderConfig {
  /** OpenAI-compatible base URL, no trailing slash. */
  baseUrl: string;
  apiKey: string;
  /** Model id, e.g. "glm-4-flash" / "deepseek-chat". */
  model: string;
}

export const PRESETS: Record<string, Omit<ProviderConfig, "apiKey">> = {
  zhipu: { baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  moonshot: { baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
};

export const STORAGE_KEY = "echo-uvo.byok";

export function loadByok(): ProviderConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProviderConfig;
    return parsed.apiKey ? parsed : null;
  } catch {
    return null;
  }
}

export function saveByok(config: ProviderConfig | null): void {
  if (typeof window === "undefined") return;
  if (config) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  else window.localStorage.removeItem(STORAGE_KEY);
}

/** Single chat completion. Throws on HTTP/network error with a readable message. */
export async function chatComplete(
  config: ProviderConfig,
  messages: Array<{ role: "system" | "user"; content: string }>,
  opts?: { temperature?: number; maxTokens?: number; jsonMode?: boolean; timeoutMs?: number },
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 60000);
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: opts?.temperature ?? 0.3,
        max_tokens: opts?.maxTokens ?? 2000,
        ...(opts?.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`LLM API ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM API 返回空内容");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/** Parse a JSON object out of an LLM response, tolerating code fences. */
export function parseJsonLoose<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  const slice = start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
  return JSON.parse(slice) as T;
}
