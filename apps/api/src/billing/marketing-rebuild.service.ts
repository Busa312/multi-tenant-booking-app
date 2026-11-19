import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * R560: the marketing site is static and prints the offered plans when it
 * builds (from GET /plans), so a change to a plan (R550) asks its host to
 * build it again, through a deploy hook (MARKETING_DEPLOY_HOOK_URL — a Vercel
 * deploy hook for the marketing project's branch). Best effort, like
 * RevalidationService: the saved plan is the truth; a failed call is logged,
 * never thrown, and the next deploy picks the change up anyway.
 */
@Injectable()
export class MarketingRebuild {
  private readonly logger = new Logger(MarketingRebuild.name);

  constructor(private readonly config: ConfigService) {}

  async rebuild(reason: string): Promise<void> {
    const hook = this.config.get<string>("MARKETING_DEPLOY_HOOK_URL");
    if (!hook) {
      this.logger.warn(`Not rebuilding the marketing site (${reason}): MARKETING_DEPLOY_HOOK_URL is not set`);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(hook, { method: "POST", signal: controller.signal });
      if (res.ok) this.logger.log(`Marketing site rebuild requested (${reason})`);
      else this.logger.warn(`Marketing site rebuild failed with status ${res.status} (${reason})`);
    } catch (err) {
      this.logger.warn(`Marketing site rebuild errored (${reason}): ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
