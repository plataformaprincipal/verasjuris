import { describe, expect, it, vi } from "vitest";
import { AsaasBillingProvider } from "./asaas-billing-provider.js";

describe("AsaasBillingProvider", () => {
  it("createSubscription MONTHLY chama /subscriptions e não marca active inventado", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const href = String(url);
      if (href.endsWith("/customers")) {
        return new Response(JSON.stringify({ id: "cus_sub" }), { status: 200 });
      }
      if (href.endsWith("/subscriptions")) {
        return new Response(
          JSON.stringify({
            id: "sub_1",
            status: "ACTIVE",
            cycle: "MONTHLY",
            nextDueDate: "2027-02-01",
            value: 49.9,
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 404 });
    });

    const provider = new AsaasBillingProvider({
      apiKey: "key",
      environment: "sandbox",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const sub = await provider.createSubscription({
      planKey: "pro",
      billingInterval: "monthly",
      idempotencyKey: "sub-idem-1",
      metadata: { amountCents: "4990", customerName: "Org" },
    });

    expect(sub.externalSubscriptionId).toBe("sub_1");
    expect(sub.providerKey).toBe("asaas");
    expect(sub.status).toBe("active"); // status real do Asaas, não inventado localmente
    const call = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/subscriptions")) as
      | [string | URL, RequestInit?]
      | undefined;
    const body = JSON.parse(String(call?.[1]?.body)) as {
      cycle: string;
      value: number;
    };
    expect(body.cycle).toBe("MONTHLY");
    expect(body.value).toBe(49.9);
  });

  it("sem amountCents devolve incomplete sem chamar API de subscription", async () => {
    const fetchMock = vi.fn();
    const provider = new AsaasBillingProvider({
      apiKey: "key",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const sub = await provider.createSubscription({ planKey: "free" });
    expect(sub.status).toBe("incomplete");
    expect(sub.externalSubscriptionId).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
