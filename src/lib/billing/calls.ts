/**
 * Count the JSON-RPC calls in a request body (1 credit = 1 call; a batch of
 * N costs N). The body is only parsed to count; the proxy still forwards the
 * original bytes untouched.
 */

export type CallCount =
  | { ok: true; calls: number }
  | { ok: false; code: number; message: string };

const isCall = (value: unknown): value is { method: string } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { method?: unknown }).method === "string";

export const countCalls = (
  body: string,
  { maxBatch, blockedMethodPrefixes }: { maxBatch: number; blockedMethodPrefixes: string[] }
): CallCount => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, code: -32700, message: "parse error" };
  }

  const calls = Array.isArray(parsed) ? parsed : [parsed];
  if (calls.length === 0) return { ok: false, code: -32600, message: "empty batch" };
  if (calls.length > maxBatch) {
    return { ok: false, code: -32600, message: `batch larger than ${maxBatch} calls` };
  }
  for (const call of calls) {
    if (!isCall(call)) return { ok: false, code: -32600, message: "invalid request" };
    if (blockedMethodPrefixes.some((prefix) => call.method.startsWith(prefix))) {
      return { ok: false, code: -32601, message: `method not available: ${call.method}` };
    }
  }
  return { ok: true, calls: calls.length };
};
