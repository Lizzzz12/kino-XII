import { test, expect, type Page } from "@playwright/test";
import options from "./options.json" with { type: "json" };
const movie = {
  id: 1,
  slug: "test-film",
  title: "The Odyssey",
  kind: "film",
  runtimeMinutes: 130,
  posterUrl: null,
  backdropUrl: null,
  releaseDate: "2026-10-04",
  isComingSoon: false,
  isFeatured: true,
  fromPrice: 20,
  ageRating: { code: "12+", minAge: 12, description: "12 and over" },
  genres: [{ id: 1, slug: "adventure", name: "Adventure" }],
  formats: [options.data.formats[0]],
  synopsis: "A cinematic journey.",
  availableDates: ["2099-10-04"],
};
const user = {
  id: 1,
  username: "Jane",
  email: "jane@example.com",
  fullName: "Jane Dolidze",
  mobileNumber: "599123456",
  dateOfBirth: "1990-01-01",
  age: 36,
  avatar: null,
  preferredVenue: null,
  profileComplete: true,
};
const session = {
  id: 1,
  startsAt: "2099-10-04T19:30:00+04:00",
  date: "2099-10-04",
  time: "19:30",
  timeBand: "evening",
  price: 20,
  seatsLeft: 40,
  isSoldOut: false,
  hall: { id: 1, name: "B" },
  venue: options.data.venues[1],
  format: options.data.formats[0],
  language: options.data.languages[0],
  movie,
};
async function mock(
  page: Page,
  { guest = false, conflict = false, incomplete = false } = {},
) {
  let holds = 0;
  let orders = 0;
  let profileComplete = !incomplete;
  let currentHold: any = null;
  await page.addInitScript(
    ({ guest }) => {
      if (localStorage.getItem("kino-test-initialized")) return;
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("kino-test-initialized", "true");
      if (!guest) localStorage.setItem("kino-token", "test-token");
    },
    { guest },
  );
  await page.route(
    "https://api.kinoxii.redberryinternship.ge/api/**",
    async (route) => {
      const path = new URL(route.request().url()).pathname.replace("/api", "");
      let data: any;
      let status = 200;
      const seatMap = {
        sessionId: 1,
        hall: { ...session.hall, venue: session.venue },
        sections: [
          {
            name: "Stalls",
            rows: [
              {
                label: "E",
                seats: [1, 2, 3].map((id) => ({
                  id,
                  code: `E${id}`,
                  label: String(id),
                  state:
                    conflict && holds > 0 && id === 2 ? "sold" : "available",
                  aisleAfter: id === 2,
                  isMine: !!currentHold?.seats.some(
                    (s: any) => s.seatId === id,
                  ),
                })),
              },
            ],
          },
        ],
      };
      if (path === "/filter-options") data = options.data;
      else if (["/movies/featured", "/movies/now-playing"].includes(path))
        data = [movie];
      else if (path === "/movies/coming-soon") data = [];
      else if (path === "/movies/test-film") data = movie;
      else if (path === "/movies/test-film/sessions")
        data = [{ venue: session.venue, sessions: [session] }];
      else if (path === "/sessions/1") data = session;
      else if (path === "/sessions/1/seats") data = seatMap;
      else if (path === "/sessions/1/holds") {
        holds++;
        const request = route.request().postDataJSON();
        if (conflict && holds === 1) {
          status = 409;
          return route.fulfill({
            status,
            json: { message: "Taken", contested: ["E2"] },
          });
        }
        currentHold = {
          holdId: "test-hold",
          sessionId: 1,
          expiresAt: new Date(Date.now() + 480000).toISOString(),
          secondsRemaining: 480,
          isLive: true,
          subtotal: request.seats.length * 20,
          seats: request.seats.map((s: any) => ({
            ...s,
            code: `E${s.seatId}`,
            ticketType: { slug: s.ticketType, name: s.ticketType },
            price: 20,
          })),
        };
        data = currentHold;
      } else if (path === "/holds/test-hold") {
        data = currentHold;
        if (route.request().method() === "DELETE") {
          currentHold = null;
          status = 204;
        }
      } else if (path === "/login")
        data = { user: { ...user, profileComplete }, token: "fresh-token" };
      else if (path === "/me") data = { ...user, profileComplete };
      else if (path === "/profile") {
        profileComplete = true;
        data = { ...user, profileComplete: true };
      } else if (path === "/orders") {
        orders++;
        data = {
          id: 1,
          reference: "KX-CONFIRMED",
          status: "paid",
          totalPrice: currentHold.subtotal,
          paidAt: new Date().toISOString(),
          isUpcoming: true,
          isRefundable: true,
          cardLastFour: "4242",
          session,
          tickets: currentHold.seats.map((s: any) => ({
            id: s.seatId,
            seatCode: s.code,
            ticketType: s.ticketType,
            price: 20,
          })),
        };
      } else if (path === "/tickets") data = [];
      else if (path === "/search") data = [movie];
      else data = [];
      if (status === 204) return route.fulfill({ status, body: "" });
      await route.fulfill({ status, json: { data } });
    },
  );
  return { holds: () => holds, orders: () => orders };
}
async function openSeats(page: Page) {
  await page.goto("/movies/test-film");
  await page.getByRole("button", { name: /19:30/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
test("guest login continues booking; conflict preserves survivors; payment submits once", async ({
  page,
}) => {
  const state = await mock(page, { guest: true, conflict: true });
  await openSeats(page);
  await page
    .getByRole("button", { name: "Seat E1, available", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Seat E2, available", exact: true })
    .click();
  await page.getByRole("button", { name: "Next: Checkout" }).click();
  const login = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Log in", exact: true }),
  });
  await login.getByLabel("Email", { exact: true }).fill("jane@example.com");
  await login.getByLabel("Password", { exact: true }).fill("password");
  await login.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("E2");
  await expect(
    page.getByRole("button", { name: "Seat E1, available", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Seat E2, sold", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Next: Checkout" }).click();
  await page
    .getByLabel("Card number", { exact: true })
    .fill("4242 4242 4242 4242");
  await page.getByLabel("Expiry (MM/YY)", { exact: true }).fill("09/99");
  await page.getByLabel("CVV", { exact: true }).fill("123");
  await page
    .getByRole("button", { name: "Pay ₾ 20.00", exact: true })
    .dblclick();
  await expect(page.getByText("KX-CONFIRMED")).toBeVisible();
  expect(state.orders()).toBe(1);
  expect(state.holds()).toBe(2);
});
test("refresh restores server hold and closing releases it", async ({
  page,
}) => {
  await mock(page);
  await openSeats(page);
  await page
    .getByRole("button", { name: "Seat E1, available", exact: true })
    .click();
  await page.getByRole("button", { name: "Next: Checkout" }).click();
  await expect(page.getByLabel("Card number", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Card number", { exact: true })).toBeVisible();
  const released = page.waitForRequest(
    (req) =>
      req.url().endsWith("/holds/test-hold") && req.method() === "DELETE",
  );
  await page
    .getByRole("button", { name: "Close", exact: true })
    .first()
    .click();
  await released;
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("incomplete profile can be completed before continuing the selected booking", async ({
  page,
}) => {
  await mock(page, { incomplete: true });
  await openSeats(page);
  await page
    .getByRole("button", { name: "Seat E1, available", exact: true })
    .click();
  await page.getByRole("button", { name: "Next: Checkout" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Full name", { exact: true }).fill("Jane Updated");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Card number", { exact: true })).toBeVisible();
});
test("search and modal Escape dismissal work at the desktop reference size", async ({
  page,
}) => {
  await mock(page, { guest: true });
  await page.goto("/");
  await page.getByLabel("Search films and events").fill("Odyssey");
  await expect(page.locator(".search-result")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".search-popover")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("wrong");
  await page.getByLabel("Username", { exact: true }).click();
  await expect(
    page.getByText("Please enter a valid email address"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
