/** The CMS's address from `CMS_URL`, without a trailing slash; the local dev server when unset. */
export function cmsBaseUrl(value: string | undefined): string {
  return (value?.trim() || "http://localhost:5173").replace(/\/+$/, "");
}
