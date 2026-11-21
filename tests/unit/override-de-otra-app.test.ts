import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerWebhookForNumber } from "@/server/whatsapp/connect";

/**
 * Un override en subscribed_apps de OTRA app no es de esta instancia: no debe
 * hacer omitir la suscripción de la nuestra (META_APP_ID).
 */
const { graphRequest, env } = vi.hoisted(() => ({
  graphRequest: vi.fn(),
  env: { META_APP_ID: "999" as string | undefined },
}));

vi.mock("@/lib/env", () => ({ getEnv: () => env }));
vi.mock("@/lib/meta/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/meta/client")>();
  return { ...original, graphRequest };
});

const WABA = "W1";
const PHONE = "P1";
const URL_PROPIA = "https://crm.ejemplo.com/api/webhooks/wa/verify-secreto-xyz";
const opts = {
  wabaId: WABA,
  phoneNumberId: PHONE,
  token: "tok",
  webhookUrl: URL_PROPIA,
  verifyToken: "verify-secreto-xyz",
};
type Call = [string, { method?: string }];
const posts = () =>
  (graphRequest.mock.calls as Call[]).filter(([, o]) => o?.method === "POST");

function meta(apps: unknown) {
  let override: string | null = null;
  graphRequest.mockImplementation(async (path: string, o: { method?: string; body?: { webhook_configuration: { override_callback_uri: string } } }) => {
    const m = o.method ?? "GET";
    if (path === `${WABA}/subscribed_apps` && m === "GET") return apps;
    if (path === `${WABA}/subscribed_apps`) return { success: true };
    if (path === PHONE && m === "POST") {
      override = o.body!.webhook_configuration.override_callback_uri || null;
      return { success: true };
    }
    return { webhook_configuration: { phone_number: override, application: "https://x" } };
  });
}

beforeEach(() => {
  graphRequest.mockReset();
  env.META_APP_ID = "999";
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("override de otra app", () => {
  it("se ignora y SÍ se suscribe y registra el override del número", async () => {
    meta({
      data: [
        {
          whatsapp_business_api_data: { id: "111" },
          override_callback_uri: "https://otro.test/api/webhooks/wa/verify-secreto-xyz",
        },
      ],
    });
    const r = await registerWebhookForNumber(opts);
    expect(r).toMatchObject({ ok: true });
    expect(r).not.toHaveProperty("skipped");
    expect(posts().some(([p]) => p === `${WABA}/subscribed_apps`)).toBe(true);
    expect(posts().some(([p]) => p === PHONE)).toBe(true);
  });

  it("el override de NUESTRA app ajeno a esta instancia sigue respetándose", async () => {
    meta({
      data: [
        {
          whatsapp_business_api_data: { id: "999" },
          override_callback_uri: "https://nea.test/api/webhooks/wa/otro",
        },
      ],
    });
    await expect(registerWebhookForNumber(opts)).resolves.toMatchObject({
      skipped: "waba_override",
    });
    expect(posts()).toHaveLength(0);
  });
});
