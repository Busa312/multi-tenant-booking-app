import type { ConfigService } from "@nestjs/config";
import { MarketingRebuild } from "./marketing-rebuild.service.js";

const HOOK = "https://api.vercel.com/v1/integrations/deploy/prj_test/hook";

function setup(hook: string | undefined, respond: () => Promise<Response>) {
  const config = { get: jest.fn(() => hook) } as unknown as ConfigService;
  const fetchMock = jest.fn(respond);
  global.fetch = fetchMock as unknown as typeof fetch;
  return { rebuild: new MarketingRebuild(config), fetchMock };
}

// R560: a plan change rebuilds the static marketing site — best effort.
describe("MarketingRebuild", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("calls the deploy hook", async () => {
    const { rebuild, fetchMock } = setup(HOOK, () => Promise.resolve(new Response("{}", { status: 201 })));

    await rebuild.rebuild("plan early changed");
    expect(fetchMock).toHaveBeenCalledWith(HOOK, expect.objectContaining({ method: "POST" }));
  });

  it("does nothing where no hook is configured (local, CI)", async () => {
    const { rebuild, fetchMock } = setup(undefined, () => Promise.resolve(new Response("{}")));

    await rebuild.rebuild("plan early changed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never fails the plan change: errors and refusals are only logged", async () => {
    await expect(setup(HOOK, () => Promise.reject(new Error("offline"))).rebuild.rebuild("x")).resolves.toBeUndefined();
    await expect(setup(HOOK, () => Promise.resolve(new Response("", { status: 500 }))).rebuild.rebuild("x")).resolves.toBeUndefined();
  });
});
