

export const MANAGE_PATH = "manage";

export function manageUrl(host: string, token: string, protocol: "http" | "https" = "https"): string {
  return `${protocol}://${host}/${MANAGE_PATH}/${encodeURIComponent(token)}`;
}
