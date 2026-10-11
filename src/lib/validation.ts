import { ageAt, today } from "./utils";
export type Values = Record<string, string | File | null>;
export function validateField(
  name: string,
  value: string | File | null,
  values: Values,
): string {
  const text = typeof value === "string" ? value.trim() : "";
  switch (name) {
    case "email":
      return !text
        ? "Email is required"
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
          ? "Please enter a valid email address"
          : "";
    case "username":
      return !text
        ? "Username is required"
        : text.length < 3
          ? "Username must be at least 3 characters"
          : "";
    case "password":
      return !text
        ? "Password is required"
        : text.length < 3
          ? "Password must be at least 3 characters"
          : "";
    case "password_confirmation":
      return !text
        ? "Please confirm your password"
        : text !== values.password
          ? "Passwords do not match"
          : "";
    case "fullName":
      return !text
        ? "Full name is required"
        : text.length < 3
          ? "Full name must be at least 3 characters"
          : text.length > 50
            ? "Full name must not exceed 50 characters"
            : "";
    case "mobileNumber": {
      const digits = text.replace(/\s/g, "");
      return !text
        ? "Mobile number is required"
        : digits.length !== 9
          ? "Mobile number must be exactly 9 digits"
          : !/^5\d{8}$/.test(digits)
            ? "Please enter a valid Georgian mobile number (9 digits starting with 5)"
            : "";
    }
    case "dateOfBirth":
      return !text
        ? "Date of birth is required"
        : !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
            Number.isNaN(Date.parse(text)) ||
            text > today()
          ? "Please enter a valid date of birth"
          : ageAt(text) < 12
            ? "You must be at least 12 years old to create an account"
            : "";
    case "cardNumber":
      return !text
        ? "Card number is required"
        : !/^\d{16}$/.test(text.replace(/\s/g, ""))
          ? "Card number must be exactly 16 digits"
          : "";
    case "expiry": {
      if (!text) return "Expiry date is required";
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(text))
        return "Please enter a valid expiry date (MM/YY)";
      const [m, y] = text.split("/").map(Number);
      return new Date(2000 + y, m, 1) <= new Date()
        ? "Your card has expired"
        : "";
    }
    case "cvv":
      return !text
        ? "CVV is required"
        : !/^\d{3}$/.test(text)
          ? "CVV must be exactly 3 digits"
          : "";
    case "avatar":
      return value instanceof File
        ? !["image/jpeg", "image/png", "image/webp"].includes(value.type)
          ? "Upload a JPG, PNG, or WebP image"
          : value.size > 2 * 1024 * 1024
            ? "Avatar must not exceed 2 MB"
            : ""
        : "";
    default:
      return "";
  }
}
