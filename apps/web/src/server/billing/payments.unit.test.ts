import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const { mockGetPlanPriceIds, mockGetStripeValue } = vi.hoisted(() => ({
  mockGetPlanPriceIds: vi.fn(),
  mockGetStripeValue: vi.fn(),
}));

vi.mock("~/env", () => ({ env: {} }));
vi.mock("../db", () => ({ db: {} }));
vi.mock("../mailer", () => ({ sendSubscriptionConfirmationEmail: vi.fn() }));
vi.mock("../service/team-service", () => ({ TeamService: {} }));
vi.mock("../logger/log", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("./stripe-config", () => ({
  getPlanPriceIds: mockGetPlanPriceIds,
  getStripeValue: mockGetStripeValue,
  getAddonPriceIds: vi.fn(),
  getAddonPriceIdsByType: vi.fn(),
  buildPriceIdToPlanMap: vi.fn(),
  PRICE_KEYS: {},
}));

import { alignOverageItems } from "./payments";

const METERS: Record<string, string> = {
  "stripe.meter.marketing": "mtr_marketing",
  "stripe.meter.transactional": "mtr_transactional",
};

function item(id: string, priceId: string, opts: { type?: string; meter?: string } = {}) {
  return {
    id,
    price: {
      id: priceId,
      metadata: opts.type ? { type: opts.type } : {},
      recurring: opts.meter ? { usage_type: "metered", meter: opts.meter } : { usage_type: "licensed", meter: null },
    },
  };
}

function subscription(items: ReturnType<typeof item>[]) {
  return { id: "sub_1", items: { data: items } } as unknown as Stripe.Subscription;
}

function stripeMock() {
  const update = vi.fn().mockResolvedValue({});
  return { stripe: { subscriptions: { update } } as unknown as Stripe, update };
}

describe("alignOverageItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStripeValue.mockImplementation(async (key: string) => METERS[key]);
    mockGetPlanPriceIds.mockResolvedValue({
      monthly: "price_pro_monthly",
      marketingUsage: "price_pro_marketing",
      transactionalUsage: "price_pro_transactional",
    });
  });

  it("swaps overage items left on the old plan after a portal plan change", async () => {
    const { stripe, update } = stripeMock();
    await alignOverageItems(
      stripe,
      subscription([
        item("si_monthly", "price_pro_monthly"),
        item("si_mkt", "price_starter_marketing", { type: "marketing-usage", meter: "mtr_marketing" }),
        item("si_tx", "price_starter_transactional", { type: "transactional-usage", meter: "mtr_transactional" }),
      ]),
      "BASIC",
    );

    expect(update).toHaveBeenCalledWith("sub_1", {
      items: [
        { id: "si_mkt", deleted: true },
        { price: "price_pro_marketing" },
        { id: "si_tx", deleted: true },
        { price: "price_pro_transactional" },
      ],
      proration_behavior: "none",
    });
  });

  it("does nothing when the overage items already match the plan", async () => {
    const { stripe, update } = stripeMock();
    await alignOverageItems(
      stripe,
      subscription([
        item("si_monthly", "price_pro_monthly"),
        item("si_mkt", "price_pro_marketing", { type: "marketing-usage", meter: "mtr_marketing" }),
        item("si_tx", "price_pro_transactional", { type: "transactional-usage", meter: "mtr_transactional" }),
      ]),
      "BASIC",
    );

    expect(update).not.toHaveBeenCalled();
  });

  it("leaves grandfathered subscriptions on an older monthly price alone", async () => {
    const { stripe, update } = stripeMock();
    await alignOverageItems(
      stripe,
      subscription([
        item("si_monthly", "price_pro_monthly_cad"),
        item("si_mkt", "price_pro_marketing_cad", { type: "marketing-usage", meter: "mtr_marketing" }),
      ]),
      "BASIC",
    );

    expect(update).not.toHaveBeenCalled();
  });

  it("recognises old overage prices without metadata by their meter", async () => {
    const { stripe, update } = stripeMock();
    await alignOverageItems(
      stripe,
      subscription([
        item("si_monthly", "price_pro_monthly"),
        item("si_mkt", "price_old_marketing", { meter: "mtr_marketing" }),
        item("si_tx", "price_pro_transactional", { type: "transactional-usage", meter: "mtr_transactional" }),
      ]),
      "BASIC",
    );

    expect(update).toHaveBeenCalledWith("sub_1", {
      items: [{ id: "si_mkt", deleted: true }, { price: "price_pro_marketing" }],
      proration_behavior: "none",
    });
  });

  it("adds a missing overage item", async () => {
    const { stripe, update } = stripeMock();
    await alignOverageItems(
      stripe,
      subscription([
        item("si_monthly", "price_pro_monthly"),
        item("si_mkt", "price_pro_marketing", { type: "marketing-usage", meter: "mtr_marketing" }),
      ]),
      "BASIC",
    );

    expect(update).toHaveBeenCalledWith("sub_1", {
      items: [{ price: "price_pro_transactional" }],
      proration_behavior: "none",
    });
  });

  it("refuses to change anything when a metered item can't be identified", async () => {
    const { stripe, update } = stripeMock();
    await alignOverageItems(
      stripe,
      subscription([
        item("si_monthly", "price_pro_monthly"),
        item("si_mystery", "price_unknown", { meter: "mtr_other" }),
        item("si_mkt", "price_starter_marketing", { type: "marketing-usage", meter: "mtr_marketing" }),
      ]),
      "BASIC",
    );

    expect(update).not.toHaveBeenCalled();
  });
});
