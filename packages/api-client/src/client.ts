import { ApiError, NetworkError } from './errors';

export interface ClientConfig {
  baseUrl: string;
  /** Returns the bearer token to attach. Resolved per-request so token rotation Just Works. */
  getAccessToken?: () => Promise<string | null> | string | null;
  /** Default headers — merged with per-request headers. */
  defaultHeaders?: Record<string, string>;
  /** Fetch impl override (RN can polyfill). Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** Request timeout in ms. Default 15s. */
  timeoutMs?: number;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export class ApiClient {
  constructor(private readonly cfg: ClientConfig) {}

  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const url = new URL(path.startsWith('/') ? path : `/${path}`, this.cfg.baseUrl);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(this.cfg.defaultHeaders ?? {}),
      ...(opts.headers ?? {}),
    };

    if (this.cfg.getAccessToken) {
      const token = await this.cfg.getAccessToken();
      if (token) headers.authorization = `Bearer ${token}`;
    }
    if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey;

    const fetchImpl = this.cfg.fetch ?? globalThis.fetch;
    const controller = new AbortController();
    const timeoutMs = this.cfg.timeoutMs ?? 15_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Chain user-provided signal with our timeout controller.
    if (opts.signal) {
      if (opts.signal.aborted) controller.abort(opts.signal.reason);
      else opts.signal.addEventListener('abort', () => controller.abort(opts.signal!.reason));
    }

    let res: Response;
    try {
      res = await fetchImpl(url.toString(), {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      throw new NetworkError(err instanceof Error ? err.message : 'fetch failed');
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    const data = text ? (JSON.parse(text) as unknown) : undefined;

    if (!res.ok) {
      const err = data as { code?: string; message?: string; details?: unknown } | undefined;
      throw new ApiError(
        res.status,
        err?.code ?? 'unknown_error',
        err?.message ?? res.statusText,
        err?.details,
      );
    }

    return data as T;
  }
}
