import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { billingConfig, billingConfigured, type BillingConfig } from "./billing-config.js";
import { flittSignature, verifyFlittSignature } from "./flitt-signature.js";

const BASE_URL = "https://pay.flitt.com/api";
const TIMEOUT_MS = 20_000;

/** An order as Flitt reports it: in a status/recurring response or a callback. Values arrive as strings or numbers. */
export type FlittOrder = Record<string, unknown> & {
  order_id?: string;
  order_status?: string;
  merchant_id?: string | number;
  amount?: string | number;
  currency?: string;
  rectoken?: string;
  masked_card?: string;
  card_type?: string;
  payment_id?: string | number;
  response_description?: string;
  signature?: string;
};

/** Flitt refused the request itself (bad signature, unknown merchant, reused order id…). */
export class FlittError extends Error {
  constructor(
    message: string,
    readonly code: string | number | undefined,
  ) {
    super(message);
  }
}

export interface CheckoutParams {
  orderId: string;
  /** Tetri. */
  amount: number;
  description: string;
  responseUrl: string;
  callbackUrl: string;
  lang: "ka" | "en" | "ru";
  /** R470: refunded automatically once approved — a card change. */
  verification?: boolean;
}

export interface RecurringParams {
  orderId: string;
  amount: number;
  description: string;
  rectoken: string;
  callbackUrl?: string;
}

/**
 * The three Flitt calls billing makes (system_design.md §12b), over plain
 * fetch with protocol 1.0.1 signatures. Order responses are signature-checked
 * here, so nothing above this class ever acts on an unsigned answer.
 */
@Injectable()
export class FlittClient {
  private readonly logger = new Logger(FlittClient.name);
  readonly config: BillingConfig;

  constructor(config: ConfigService) {
    this.config = billingConfig((key) => config.get<string>(key));
  }

  get configured(): boolean {
    return billingConfigured(this.config);
  }

  /** Flitt's hosted payment page for one order; asks for the card token back. */
  async checkoutUrl(params: CheckoutParams): Promise<string> {
    const response = await this.post("/checkout/url", {
      order_id: params.orderId,
      order_desc: params.description,
      amount: params.amount,
      currency: "GEL",
      response_url: params.responseUrl,
      server_callback_url: params.callbackUrl,
      required_rectoken: "Y",
      lang: params.lang,
      // An unpaid order dies after an hour; a new checkout makes a new one.
      lifetime: 3600,
      ...(params.verification ? { verification: "Y" } : {}),
    });
    const url = response.checkout_url;
    if (typeof url !== "string" || !url.startsWith("https://")) throw new FlittError("Flitt returned no checkout page", undefined);
    return url;
  }

  /** Charges a saved card, host to host. The answer is the order's outcome. */
  recurring(params: RecurringParams): Promise<FlittOrder> {
    return this.postOrder("/recurring", {
      order_id: params.orderId,
      order_desc: params.description,
      amount: params.amount,
      currency: "GEL",
      rectoken: params.rectoken,
      ...(params.callbackUrl ? { server_callback_url: params.callbackUrl } : {}),
    });
  }

  /** Where an order stands now. */
  status(orderId: string): Promise<FlittOrder> {
    return this.postOrder("/status/order_id", { order_id: orderId });
  }

  /** A callback or response really came from Flitt for our merchant. */
  isAuthentic(order: FlittOrder): boolean {
    const { merchantId, secretKey } = this.config;
    if (merchantId === null || secretKey === null) return false;
    return String(order.merchant_id) === String(merchantId) && verifyFlittSignature(secretKey, order);
  }

  private async postOrder(path: string, params: Record<string, unknown>): Promise<FlittOrder> {
    const order = (await this.post(path, params)) as FlittOrder;
    if (!this.isAuthentic(order)) throw new FlittError("Flitt's answer failed its signature check", undefined);
    return order;
  }

  private async post(path: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { merchantId, secretKey } = this.config;
    if (merchantId === null || secretKey === null) throw new FlittError("Flitt isn't configured", undefined);
    const request: Record<string, unknown> = { version: "1.0.1", merchant_id: merchantId, ...params };
    request.signature = flittSignature(secretKey, request);

    const res = await fetch(BASE_URL + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => null)) as { response?: Record<string, unknown> } | null;
    const response = body?.response;
    if (!response) throw new FlittError(`Flitt answered ${res.status} without a response`, res.status);
    if (response.response_status === "failure") {
      this.logger.warn(`Flitt ${path} refused: ${String(response.error_code)} ${String(response.error_message)}`);
      throw new FlittError(String(response.error_message ?? "Flitt refused the request"), response.error_code as string | number);
    }
    return response;
  }
}
