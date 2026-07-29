export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API request failed with status ${status}`);
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Called on every request; return the CMS JWT if the caller is authenticated. */
  getAuthToken?: () => string | null | undefined;
  /**
   * Called on every request; used by apps/public-site's server-side fetches to
   * forward the browser's original Host header (as `x-forwarded-host`, since
   * a server-to-server fetch's own Host header is the API's, not the tenant's)
   * — see HostTenantMiddleware in apps/api, which reads it in preference to `host`.
   */
  getExtraHeaders?: () => Record<string, string> | undefined;
  /**
   * Called with the request path whenever the API answers 401, before the
   * ApiError is thrown — so a caller can end the local session centrally
   * instead of every page mistaking an expired token for a load failure.
   * The path is passed because not every 401 is a dead session: a rejected
   * login is one too, and the handler needs to tell them apart.
   */
  onUnauthorized?: (path: string) => void;
}

export class HttpClient {
  constructor(private readonly options: ApiClientOptions) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    // Only set when there's a body: Fastify's default JSON parser rejects a
    // request that declares application/json but sends an empty body
    // (FST_ERR_CTP_EMPTY_JSON_BODY, 400) — bodyless calls like post(path)
    // with no argument would otherwise always fail before reaching the handler.
    if (init.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    const token = this.options.getAuthToken?.();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const extraHeaders = this.options.getExtraHeaders?.();
    if (extraHeaders) {
      for (const [key, value] of Object.entries(extraHeaders)) {
        headers.set(key, value);
      }
    }

    const res = await fetch(`${this.options.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!res.ok) {
      if (res.status === 401) {
        this.options.onUnauthorized?.(path);
      }
      const body = await res.json().catch(() => undefined);
      throw new ApiError(res.status, body);
    }

    // Nest's default success status for DELETE/PATCH is 200, not 204 — an
    // empty body isn't limited to 204 (confirmed: DELETE /cms/professionals/:id
    // returns 200 with content-length 0), so check the actual body rather
    // than trusting the status code, or res.json() throws a SyntaxError on
    // an empty response.
    const text = await res.text();
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  get<T>(path: string) {
    return this.request<T>(path, { method: "GET" });
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: "DELETE" });
  }
}
