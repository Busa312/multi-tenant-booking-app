import { adminPageCsp, renderAdminPage } from "./admin-page.js";

const config = { cmsUrl: "https://cms.example.ge", siteBaseDomain: "example.ge", siteProtocol: "https" as const };

// R430
describe("admin page", () => {
  it("gives its only script and stylesheet the request's nonce, and the policy allows nothing else", () => {
    const html = renderAdminPage("abc123", config);

    const scripts = html.match(/<script[^>]*>/g) ?? [];
    const styles = html.match(/<style[^>]*>/g) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    expect([...scripts, ...styles].every((tag) => tag.includes('nonce="abc123"'))).toBe(true);
    expect(adminPageCsp("abc123")).toContain("script-src 'nonce-abc123'");
    expect(adminPageCsp("abc123")).toContain("default-src 'none'");
    expect(adminPageCsp("abc123")).toContain("frame-ancestors 'none'");
  });

  it("uses no inline event handlers, which the policy would block", () => {
    expect(renderAdminPage("n", config)).not.toMatch(/\son[a-z]+=/);
  });

  it("can't be broken out of by what it's configured with", () => {
    const html = renderAdminPage("n", { ...config, cmsUrl: "</script><script>alert(1)</script>" });

    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c/script>");
  });
});
