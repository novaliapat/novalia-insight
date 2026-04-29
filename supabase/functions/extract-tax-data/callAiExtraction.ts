// Appel Lovable AI Gateway + classification des erreurs réseau / provider.
// Sortie standardisée pour permettre retry / fallback / audit propre.

export type ExtractionAiErrorCode =
  | "NO_TOOL_CALL"
  | "PROVIDER_UNAVAILABLE"
  | "NETWORK"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "PAYMENT_REQUIRED"
  | "UNPARSABLE"
  | "HTTP_ERROR";

export interface AiExtractionSuccess {
  ok: true;
  rawArguments: string;
  rawAiJson: unknown;
  modelUsed: string;
}

export interface AiExtractionFailure {
  ok: false;
  code: ExtractionAiErrorCode;
  status?: number;
  providerError?: string;
  retryable: boolean;
  modelUsed: string;
}

export type AiExtractionResult = AiExtractionSuccess | AiExtractionFailure;

export function isRetryableErrorCode(code: ExtractionAiErrorCode): boolean {
  return (
    code === "NO_TOOL_CALL" ||
    code === "PROVIDER_UNAVAILABLE" ||
    code === "NETWORK" ||
    code === "TIMEOUT"
  );
}

export function classifyHttpStatus(status: number): ExtractionAiErrorCode {
  if (status === 429) return "RATE_LIMITED";
  if (status === 402) return "PAYMENT_REQUIRED";
  if (status === 502 || status === 503 || status === 504) return "PROVIDER_UNAVAILABLE";
  return "HTTP_ERROR";
}

export function classifyThrownError(err: unknown): ExtractionAiErrorCode {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("network") || lower.includes("connection")) return "NETWORK";
  if (lower.includes("timeout") || lower.includes("timed out")) return "TIMEOUT";
  return "NETWORK";
}

interface CallParams {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userContent: Array<Record<string, unknown>>;
  toolSchema: Record<string, unknown>;
  toolName: string;
  signalTimeoutMs?: number;
}

export async function callAiExtraction(params: CallParams): Promise<AiExtractionResult> {
  const { apiKey, model, systemPrompt, userContent, toolSchema, toolName } = params;

  let resp: Response;
  try {
    const ac = new AbortController();
    const t = params.signalTimeoutMs
      ? setTimeout(() => ac.abort(), params.signalTimeoutMs)
      : null;
    try {
      resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          tools: [toolSchema],
          tool_choice: { type: "function", function: { name: toolName } },
        }),
        signal: ac.signal,
      });
    } finally {
      if (t) clearTimeout(t);
    }
  } catch (err) {
    return {
      ok: false,
      code: classifyThrownError(err),
      providerError: err instanceof Error ? err.message : String(err),
      retryable: true,
      modelUsed: model,
    };
  }

  if (!resp.ok) {
    const code = classifyHttpStatus(resp.status);
    let providerError = `HTTP ${resp.status}`;
    try {
      providerError = await resp.text();
    } catch { /* ignore */ }
    return {
      ok: false,
      code,
      status: resp.status,
      providerError: providerError.slice(0, 500),
      retryable: code === "PROVIDER_UNAVAILABLE",
      modelUsed: model,
    };
  }

  let aiJson: unknown;
  try {
    aiJson = await resp.json();
  } catch (err) {
    return {
      ok: false,
      code: "UNPARSABLE",
      providerError: err instanceof Error ? err.message : String(err),
      retryable: false,
      modelUsed: model,
    };
  }

  const toolCall =
    (aiJson as { choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }> })
      ?.choices?.[0]?.message?.tool_calls?.[0];
  const args = toolCall?.function?.arguments;
  if (!args || typeof args !== "string") {
    // Tenter d'extraire un finishReason/refus pour audit
    const finishReason =
      (aiJson as { choices?: Array<{ finish_reason?: string }> })?.choices?.[0]
        ?.finish_reason ?? "unknown";
    return {
      ok: false,
      code: "NO_TOOL_CALL",
      providerError: `finish_reason=${finishReason}`,
      retryable: true,
      modelUsed: model,
    };
  }

  return {
    ok: true,
    rawArguments: args,
    rawAiJson: aiJson,
    modelUsed: model,
  };
}
