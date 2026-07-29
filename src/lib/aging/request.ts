const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

interface FetchRetryOptions {
  attempts?: number;
  timeoutMs?: number;
  retryBaseDelayMs?: number;
}

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_ATTEMPTS = 2;

/**
 * 云端图像服务存在偶发的限流和网关抖动。只重试明确的瞬态错误，避免把
 * 参数、鉴权或内容安全错误重复提交给服务商。
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  {
    attempts = DEFAULT_ATTEMPTS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryBaseDelayMs = 800,
  }: FetchRetryOptions = {},
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(input, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === attempts - 1) {
        return response;
      }

      await response.body?.cancel();
      await delay(retryDelay(response.headers.get("retry-after"), retryBaseDelayMs, attempt));
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) throw error;
      await delay(retryBaseDelayMs * 2 ** attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("云端图像服务请求失败");
}

export async function readJsonResponse<T>(response: Response, providerName: string): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${providerName} 响应格式异常（HTTP ${response.status}）`);
  }
}

function retryDelay(retryAfter: string | null, baseDelayMs: number, attempt: number): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 5_000);

    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) return Math.min(Math.max(0, retryAt - Date.now()), 5_000);
  }

  return baseDelayMs * 2 ** attempt;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
