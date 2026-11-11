import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { CSRF_HEADER, CSRF_HEADER_VALUE, CsrfGuard } from "./csrf.guard.js";

// R320: the cookie rides along on any request the browser sends — so state
// changes must prove they came from the CMS's own scripts
const context = (method: string, url: string, headers: Record<string, string> = {}) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ method, url, headers }) }) }) as unknown as ExecutionContext;

describe("CsrfGuard", () => {
  const guard = new CsrfGuard();

  it("lets reads through", () => {
    expect(guard.canActivate(context("GET", "/cms/appointments"))).toBe(true);
  });

  it("refuses a CMS write without the header — what a cross-site form would send", () => {
    expect(() => guard.canActivate(context("POST", "/cms/appointments"))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context("PATCH", "/cms/tenant/booking-rules?x=1"))).toThrow(ForbiddenException);
  });

  it("lets a CMS write with the header through", () => {
    expect(guard.canActivate(context("POST", "/cms/auth/login", { [CSRF_HEADER]: CSRF_HEADER_VALUE }))).toBe(true);
  });

  it("leaves the public API alone — it has no cookie to ride on", () => {
    expect(guard.canActivate(context("POST", "/public/appointments"))).toBe(true);
  });
});
