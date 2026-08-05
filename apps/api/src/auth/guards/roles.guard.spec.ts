import "reflect-metadata";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Roles } from "../decorators/roles.decorator.js";
import { RolesGuard } from "./roles.guard.js";
import { TenantContextService } from "../../tenant/tenant-context.service.js";

// Real handlers carrying real @Roles metadata, so the guard is exercised
// through the same reflection path Nest uses at runtime.
class TestController {
  @Roles("owner")
  ownerOnly(): void {}

  @Roles("owner", "professional")
  anyStaff(): void {}

  @Roles()
  emptyRoles(): void {}

  unrestricted(): void {}
}

@Roles("owner")
class OwnerOnlyController {
  inherited(): void {}
}

const executionContext = (handler: () => void, controller: new () => unknown = TestController): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => controller,
  }) as unknown as ExecutionContext;

describe("RolesGuard", () => {
  let tenantContext: TenantContextService;
  let guard: RolesGuard;

  const asRole = (role: "owner" | "professional" | undefined, fn: () => void): void => {
    tenantContext.runWithNewContext(() => {
      tenantContext.update({ tenantId: "t1", ...(role ? { role } : {}) });
      fn();
    });
  };

  beforeEach(() => {
    tenantContext = new TenantContextService();
    guard = new RolesGuard(new Reflector(), tenantContext);
  });

  it("lets an unannotated handler through without reading the role", () => {
    asRole(undefined, () => {
      expect(guard.canActivate(executionContext(TestController.prototype.unrestricted))).toBe(true);
    });
  });

  it("treats @Roles() with no roles as unrestricted", () => {
    asRole(undefined, () => {
      expect(guard.canActivate(executionContext(TestController.prototype.emptyRoles))).toBe(true);
    });
  });

  it("admits a role the handler lists", () => {
    asRole("owner", () => {
      expect(guard.canActivate(executionContext(TestController.prototype.ownerOnly))).toBe(true);
    });
  });

  it("admits either role when the handler lists both", () => {
    asRole("professional", () => {
      expect(guard.canActivate(executionContext(TestController.prototype.anyStaff))).toBe(true);
    });
  });

  it("rejects a role the handler does not list", () => {
    asRole("professional", () => {
      expect(() => guard.canActivate(executionContext(TestController.prototype.ownerOnly))).toThrow(
        ForbiddenException,
      );
    });
  });

  it("names the acceptable roles in the rejection", () => {
    asRole("professional", () => {
      expect(() => guard.canActivate(executionContext(TestController.prototype.ownerOnly))).toThrow(
        "Requires role: owner",
      );
    });
  });

  it("rejects an authenticated request that carries no role at all", () => {
    // A tenant is resolved but JwtAuthGuard never set a role — fail closed.
    asRole(undefined, () => {
      expect(() => guard.canActivate(executionContext(TestController.prototype.ownerOnly))).toThrow(
        ForbiddenException,
      );
    });
  });

  it("applies class-level @Roles to a handler that has none of its own", () => {
    asRole("professional", () => {
      expect(() =>
        guard.canActivate(executionContext(OwnerOnlyController.prototype.inherited, OwnerOnlyController)),
      ).toThrow(ForbiddenException);
    });
  });

  it("lets a handler's own @Roles override the class-level one", () => {
    // getAllAndOverride takes the handler's metadata first.
    asRole("professional", () => {
      expect(guard.canActivate(executionContext(TestController.prototype.anyStaff))).toBe(true);
    });
  });

  it("refuses rather than defaulting when it runs before the tenant is resolved", () => {
    tenantContext.runWithNewContext(() => {
      expect(() => guard.canActivate(executionContext(TestController.prototype.ownerOnly))).toThrow(
        /before tenant_id was resolved/,
      );
    });
  });
});
