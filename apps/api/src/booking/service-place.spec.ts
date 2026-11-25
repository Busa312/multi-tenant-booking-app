import { BadRequestException } from "@nestjs/common";
import {
  assertOfferedAt,
  offeredAt,
  padded,
  parseCustomerAddress,
  parseServicePlace,
  parseVisitPlace,
  placeColumns,
} from "./service-place.js";

// R630: where a visit takes place

describe("places", () => {
  it("reads a visit's place, at the business when omitted", () => {
    expect(parseVisitPlace(undefined)).toBe("business");
    expect(parseVisitPlace("")).toBe("business");
    expect(parseVisitPlace("customer")).toBe("customer");
    expect(() => parseVisitPlace("either")).toThrow(BadRequestException);
    expect(() => parseServicePlace("home")).toThrow(BadRequestException);
    expect(parseServicePlace("either")).toBe("either");
  });

  it("offers a service where it's set up, and 'either' at both", () => {
    expect(offeredAt("business", "business")).toBe(true);
    expect(offeredAt("business", "customer")).toBe(false);
    expect(offeredAt("customer", "customer")).toBe(true);
    expect(offeredAt("customer", "business")).toBe(false);
    expect(offeredAt("either", "customer")).toBe(true);
    expect(offeredAt("either", "business")).toBe(true);
  });

  it("keeps one visit in one place", () => {
    const lines = [
      { serviceId: "s1", name: "Manicure", place: "either" },
      { serviceId: "s2", name: "Hair colour", place: "business" },
    ];
    expect(() => assertOfferedAt(lines, "business")).not.toThrow();
    expect(() => assertOfferedAt(lines, "customer")).toThrow(`"Hair colour" isn't offered at the customer's address`);
    expect(() => assertOfferedAt([{ serviceId: "s3", name: "Cleaning", place: "customer" }], "business")).toThrow(
      `"Cleaning" is only offered at the customer's address`,
    );
  });

  it("keeps a service a booking already has, even if it has since moved place", () => {
    const lines = [{ serviceId: "s2", name: "Hair colour", place: "business" }];
    expect(() => assertOfferedAt(lines, "customer", new Set(["s2"]))).not.toThrow();
  });
});

describe("parseCustomerAddress", () => {
  it("requires a street address at the customer's, and trims what it keeps", () => {
    expect(parseCustomerAddress("customer", { customerAddress: "  Vazha-Pshavela 12 ", customerAddressDetails: " apt 5 " })).toEqual({
      address: "Vazha-Pshavela 12",
      details: "apt 5",
      note: null,
    });
    expect(() => parseCustomerAddress("customer", {})).toThrow("customerAddress is required");
    expect(() => parseCustomerAddress("customer", { customerAddress: "   " })).toThrow("customerAddress is required");
  });

  it("refuses an address for a visit at the business", () => {
    expect(parseCustomerAddress("business", {})).toBeNull();
    expect(() => parseCustomerAddress("business", { customerAddress: "Somewhere 1" })).toThrow(BadRequestException);
  });

  it("caps the lengths", () => {
    expect(() => parseCustomerAddress("customer", { customerAddress: "a".repeat(201) })).toThrow("at most 200");
    expect(() => parseCustomerAddress("customer", { customerAddress: "x", customerAddressNote: "n".repeat(301) })).toThrow("at most 300");
  });
});

describe("placeColumns and padding", () => {
  it("stores the address and travel only for a visit at the customer's", () => {
    expect(placeColumns("customer", { address: "A 1", details: null, note: "gate 42" }, 30)).toEqual({
      place: "customer",
      customerAddress: "A 1",
      customerAddressDetails: null,
      customerAddressNote: "gate 42",
      travelMinutes: 30,
    });
    expect(placeColumns("business", null, 30)).toMatchObject({ place: "business", customerAddress: null, travelMinutes: 0 });
  });

  it("pads an interval on both sides", () => {
    expect(padded(new Date("2026-01-01T10:00:00Z"), new Date("2026-01-01T11:00:00Z"), 30)).toEqual({
      start: Date.parse("2026-01-01T09:30:00Z"),
      end: Date.parse("2026-01-01T11:30:00Z"),
    });
    expect(padded(0, 60_000, 0)).toEqual({ start: 0, end: 60_000 });
  });
});
