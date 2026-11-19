import { Body, Controller, Post, Res } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import type { ContactFormRequest } from "@booking/shared-types";
import { RateLimit } from "../rate-limit/rate-limit.decorator.js";
import { ContactService } from "./contact.service.js";

/**
 * R580: the marketing site's contact form posts here as a plain HTML form (no
 * script), so the answer is a redirect back to the site — its thank-you page
 * or its try-again page. Public, and limited per address (R330).
 */
@Controller("contact")
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @ApiExcludeEndpoint()
  @RateLimit({ name: "contact", max: 5, windowSeconds: 60 * 60 }, { name: "contact-day", max: 20, windowSeconds: 24 * 60 * 60 })
  async submit(@Body() body: ContactFormRequest, @Res() reply: FastifyReply): Promise<void> {
    const { locale, result } = await this.contact.submit(body);
    const target = this.contact.redirectFor(locale, result);
    // Without MARKETING_URL there's no page to send them to; say what happened.
    if (!target) {
      await reply.status(result === "thanks" ? 201 : 400).send({ result });
      return;
    }
    await reply.redirect(303, target);
  }
}
