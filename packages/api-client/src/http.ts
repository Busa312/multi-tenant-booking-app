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
}

export class HttpClient {
  constructor(private readonly options: ApiClientOptions) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");

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
      const body = await res.json().catch(() => undefined);
      throw new ApiError(res.status, body);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return (await res.json()) as T;
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
