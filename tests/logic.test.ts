import { describe, expect, it } from "vitest";
import { allowedFormats, reconcile, remaining, ageAt } from "../src/lib/utils";
import { validateField } from "../src/lib/validation";
describe("seat hold recovery", () => {
  it("removes contested seats and retains surviving ticket types", () => {
    const selection = [
      { seatId: 41, code: "E7", ticketType: "student" },
      { seatId: 42, code: "E8", ticketType: "adult" },
    ];
    expect(reconcile(selection, ["E8"])).toEqual([selection[0]]);
  });
  it("uses the absolute server deadline even after a backgrounded tab resumes", () => {
    const deadline = "2026-10-04T18:08:00Z";
    expect(remaining(deadline, Date.parse("2026-10-04T18:00:00Z"))).toBe(480);
    expect(remaining(deadline, Date.parse("2026-10-04T18:07:35Z"))).toBe(25);
    expect(remaining(deadline, Date.parse("2026-10-04T18:09:00Z"))).toBe(0);
  });
});
describe("session filters", () => {
  const options = {
    venues: [
      { slug: "a", formats: [{ slug: "standard" }, { slug: "max" }] },
      { slug: "b", formats: [{ slug: "standard" }, { slug: "atmos" }] },
    ],
    formats: [
      { slug: "standard" },
      { slug: "max" },
      { slug: "atmos" },
      { slug: "motion" },
    ],
  };
  it("unions formats across selected venues and excludes unsupported formats", () =>
    expect([...allowedFormats(options, ["a", "b"])]).toEqual([
      "standard",
      "max",
      "atmos",
    ]));
  it("allows every format when no venue is selected", () =>
    expect(allowedFormats(options, []).has("motion")).toBe(true));
});
describe("profile and payment rules", () => {
  it("distinguishes empty, wrong length, and wrong mobile format", () => {
    expect(validateField("mobileNumber", "", {})).toBe(
      "Mobile number is required",
    );
    expect(validateField("mobileNumber", "5991", {})).toContain("exactly 9");
    expect(validateField("mobileNumber", "499123456", {})).toContain(
      "starting with 5",
    );
    expect(validateField("mobileNumber", "599 123 456", {})).toBe("");
  });
  it("handles the birthday boundary for age eligibility", () => {
    expect(ageAt("2014-10-05", new Date("2026-10-04T12:00:00"))).toBe(11);
    expect(ageAt("2014-10-04", new Date("2026-10-04T12:00:00"))).toBe(12);
  });
  it("rejects malformed card details and expired cards", () => {
    expect(validateField("cardNumber", "4242 4242 4242 4242", {})).toBe("");
    expect(validateField("cardNumber", "4242", {})).toContain("16");
    expect(validateField("expiry", "13/30", {})).toContain("valid");
    expect(validateField("expiry", "01/20", {})).toContain("expired");
    expect(validateField("cvv", "1a3", {})).toContain("3 digits");
  });
  it("rejects confirmation mismatches", () =>
    expect(
      validateField("password_confirmation", "bad", { password: "secret" }),
    ).toBe("Passwords do not match"));
});
