import { adminPageCsp, renderAdminPage } from "./admin-page.js";

const config = { cmsUrl: "https://cms.example.ge", siteBaseDomain: "example.ge", siteProtocol: "https" as const, mailConfigured: true };

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

  // The script is a string inside a template literal: an escape that goes wrong there only shows in a browser.
  it.each([true, false])("renders a script that parses (mail configured: %s)", (mailConfigured) => {
    const html = renderAdminPage("n", { ...config, mailConfigured });
    const script = html.slice(html.indexOf("<script nonce"), html.lastIndexOf("</script>")).replace(/^<script[^>]*>/, "");
    expect(() => new Function(script)).not.toThrow();
  });

  // R430
  it("offers both ways to give the owner a password, and a fresh link per salon", () => {
    const html = renderAdminPage("n", config);
    expect(html).toContain('id="f-access-link"');
    expect(html).toContain('id="f-access-password"');
    expect(html).toContain("/owner-link");
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
