// Appel Anthropic Claude API + classification des erreurs réseau / provider.
// Sortie standardisée pour permettre retry / fallback / audit propre.
//
// La surface publique (CallParams, AiExtractionResult, etc.) est volontairement
// inchangée pour limiter l'impact côté appelants : on continue à recevoir un
// userContent au format "OpenAI-like" ({type: "text"} / {type: "image_url"})
// et on l'adapte ici au format Anthropic (image / document base64).

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

// Convertit notre format "OpenAI-like" en blocs Anthropic.
// - {type: "text", text} -> {type: "text", text}
// - {type: "image_url", image_url: {url: "data:<mime>;base64,<data>"}}
//   -> {type: "image", source: {type: "base64", media_type, data}}
//   (ou {type: "document", ...} pour application/pdf)
function adaptUserContentToAnthropic(
  userContent: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = [];
  for (const part of userContent) {
    const type = part?.type as string | undefined;
    if (type === "text" && typeof part.text === "string") {
      blocks.push({ type: "text", text: part.text });
      continue;
    }
    if (type === "image_url") {
      const url = (part.image_url as { url?: string } | undefined)?.url;
      if (typeof url === "string" && url.startsWith("data:")) {
        const match = url.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const mediaType = match[1];
          const data = match[2];
          if (mediaType === "application/pdf") {
            blocks.push({
              type: "document",
              source: { type: "base64", media_type: mediaType, data },
            });
          } else {
            blocks.push({
              type: "image",
              source: { type: "base64", media_type: mediaType, data },
            });
          }
          continue;
        }
      }
    }
    // Fallback : on ignore silencieusement les blocs non reconnus.
  }
  return blocks;
}

// Tool schema attendu par les appelants (format OpenAI) :
//   { type: "function", function: { name, description, parameters } }
// Anthropic attend : { name, description, input_schema }
function adaptToolSchemaToAnthropic(
  toolSchema: Record<string, unknown>,
  fallbackName: string,
): Record<string, unknown> {
  const fn = (toolSchema as { function?: Record<string, unknown> }).function;
  if (fn) {
    return {
      name: (fn.name as string) ?? fallbackName,
      description: (fn.description as string) ?? "",
      input_schema: (fn.parameters as Record<string, unknown>) ?? { type: "object", properties: {} },
    };
  }
  // Si jamais c'est déjà au format Anthropic
  if (typeof toolSchema.name === "string" && toolSchema.input_schema) {
    return toolSchema;
  }
  return {
    name: fallbackName,
    description: "",
    input_schema: { type: "object", properties: {} },
  };
}

export async function callAiExtraction(params: CallParams): Promise<AiExtractionResult> {
  const { apiKey, model, systemPrompt, userContent, toolSchema, toolName } = params;

  const anthropicTool = adaptToolSchemaToAnthropic(toolSchema, toolName);
  const anthropicContent = adaptUserContentToAnthropic(userContent);

  let resp: Response;
  try {
    const ac = new AbortController();
    const t = params.signalTimeoutMs
      ? setTimeout(() => ac.abort(), params.signalTimeoutMs)
      : null;
    try {
      resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 8192,
          system: systemPrompt,
          messages: [
            { role: "user", content: anthropicContent },
          ],
          tools: [anthropicTool],
          tool_choice: { type: "tool", name: toolName },
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

  // Réponse Anthropic : { content: [{type: "tool_use", name, input}, ...], stop_reason }
  const contentArr =
    (aiJson as { content?: Array<{ type?: string; name?: string; input?: unknown }> })?.content;
  const toolUse = Array.isArray(contentArr)
    ? contentArr.find((b) => b?.type === "tool_use" && b?.name === toolName)
      ?? contentArr.find((b) => b?.type === "tool_use")
    : undefined;

  if (!toolUse || toolUse.input === undefined) {
    const stopReason =
      (aiJson as { stop_reason?: string })?.stop_reason ?? "unknown";
    return {
      ok: false,
      code: "NO_TOOL_CALL",
      providerError: `stop_reason=${stopReason}`,
      retryable: true,
      modelUsed: model,
    };
  }

  // On ré-encode en string pour conserver la surface API existante (rawArguments: string).
  let rawArguments: string;
  try {
    rawArguments = JSON.stringify(toolUse.input);
  } catch (err) {
    return {
      ok: false,
      code: "UNPARSABLE",
      providerError: err instanceof Error ? err.message : String(err),
      retryable: false,
      modelUsed: model,
    };
  }

  return {
    ok: true,
    rawArguments,
    rawAiJson: aiJson,
    modelUsed: model,
  };
}
