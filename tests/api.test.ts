import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, ApiError, setReauthenticate, tokenStore } from "../src/lib/api";
const storage = new Map<string, string>();
beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => storage.get(k) || null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  });
  storage.clear();
});
afterEach(() => vi.unstubAllGlobals());
it("replays a protected request once after successful reauthentication", async () => {
  tokenStore.set("old");
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Unauthenticated." }), {
        status: 401,
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { reference: "KX-OK" } }), {
        status: 201,
      }),
    );
  vi.stubGlobal("fetch", fetch);
  const reauth = vi.fn(async () => tokenStore.set("new"));
  setReauthenticate(reauth);
  const body = JSON.stringify({ holdId: "h" });
  expect(
    (await api<{ reference: string }>("/orders", { method: "POST", body })).data
      .reference,
  ).toBe("KX-OK");
  expect(reauth).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1][1].body).toBe(body);
  expect(fetch.mock.calls[1][1].headers.get("Authorization")).toBe(
    "Bearer new",
  );
});
it("keeps bad login credentials in the login flow without retrying", async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ message: "Invalid credentials." }), {
      status: 401,
    }),
  );
  vi.stubGlobal("fetch", fetch);
  const reauth = vi.fn(async () => {});
  setReauthenticate(reauth);
  await expect(
    api("/login", { method: "POST", body: "{}" }),
  ).rejects.toMatchObject({ status: 401, message: "Invalid credentials." });
  expect(reauth).not.toHaveBeenCalled();
});
it("preserves server field validation and contested seat codes", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Taken", contested: ["E7"] }), {
        status: 409,
      }),
    ),
  );
  try {
    await api("/sessions/1/holds", { method: "POST", body: "{}" });
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).body.contested).toEqual(["E7"]);
  }
});
