import { BadRequestException } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { TenantContextService } from "../tenant/tenant-context.service.js";
import { type BillingService, orderIdFor } from "./billing.service.js";
import { FlittController } from "./flitt.controller.js";
import type { FlittClient } from "./flitt.client.js";

const TENANT = "11111111-1111-1111-1111-111111111111";

function setup(authentic: boolean) {
  const billing = { applyOrder: jest.fn().mockResolvedValue(undefined) };
  const flitt = { isAuthentic: jest.fn(() => authentic), config: { cmsUrl: "https://cms.example.com" } };
  const tenantContext = { runWithTenant: jest.fn((_id: string, fn: () => Promise<unknown>) => fn()) };
  const controller = new FlittController(
    billing as unknown as BillingService,
    flitt as unknown as FlittClient,
    tenantContext as unknown as TenantContextService,
  );
  return { controller, billing, tenantContext };
}

// R470: system_design.md §12b
describe("FlittController.callback", () => {
  const order = { order_id: orderIdFor(TENANT, "signup", "abc"), order_status: "approved", merchant_id: 1549901, signature: "x" };

  it("applies a signed result in its tenant's context", async () => {
    const { controller, billing, tenantContext } = setup(true);

    await expect(controller.callback(order)).resolves.toBe("OK");
    expect(tenantContext.runWithTenant).toHaveBeenCalledWith(TENANT, expect.any(Function));
    expect(billing.applyOrder).toHaveBeenCalledWith(order);
  });

  it("accepts the result wrapped in a response object too", async () => {
    const { controller, billing } = setup(true);

    await controller.callback({ response: order });
    expect(billing.applyOrder).toHaveBeenCalledWith(order);
  });

  it("refuses anything unsigned or signed with another key — and applies nothing", async () => {
    const { controller, billing } = setup(false);

    await expect(controller.callback(order)).rejects.toThrow(BadRequestException);
    expect(billing.applyOrder).not.toHaveBeenCalled();
  });

  it("acknowledges an order that isn't one of ours without touching anything", async () => {
    const { controller, billing } = setup(true);

    await expect(controller.callback({ ...order, order_id: "TestOrder2" })).resolves.toBe("OK");
    expect(billing.applyOrder).not.toHaveBeenCalled();
  });
});

describe("FlittController.back", () => {
  interface ReplyStub {
    code: jest.Mock;
    header: jest.Mock;
    send: jest.Mock;
    headers: Record<string, string>;
  }
  const reply = (): ReplyStub => {
    const r: ReplyStub = { code: jest.fn(), header: jest.fn(), send: jest.fn(), headers: {} };
    r.code.mockReturnValue(r);
    r.send.mockReturnValue(r);
    r.header.mockImplementation((key: string, value: string) => {
      r.headers[key] = value;
      return r;
    });
    return r;
  };

  it("sends the payer to the CMS subscription page with the order to confirm", () => {
    const { controller } = setup(true);
    const r = reply();
    const id = orderIdFor(TENANT, "signup", "abc");

    controller.back(id, r as unknown as FastifyReply);

    expect(r.code).toHaveBeenCalledWith(303);
    expect(r.headers.location).toBe(`https://cms.example.com/settings/subscription?payment=${encodeURIComponent(id)}`);
  });

  it("never carries anything but one of our order ids along", () => {
    const { controller } = setup(true);
    const r = reply();

    controller.back("https://evil.example.com", r as unknown as FastifyReply);

    expect(r.headers.location).toBe("https://cms.example.com/settings/subscription");
  });
});
