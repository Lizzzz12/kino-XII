export const money = (value: number) => `₾ ${Number(value).toFixed(2)}`;
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tbilisi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
export function ageAt(birth: string, now = new Date()) {
  const b = new Date(`${birth}T12:00:00`);
  let age = now.getFullYear() - b.getFullYear();
  if (
    now.getMonth() < b.getMonth() ||
    (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())
  )
    age--;
  return age;
}
export function remaining(expiresAt: string, now = Date.now()) {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
}
export function allowedFormats(
  options: {
    venues: { slug: string; formats: { slug: string }[] }[];
    formats: { slug: string }[];
  },
  venues: string[],
) {
  return new Set(
    (venues.length
      ? options.venues
          .filter((v) => venues.includes(v.slug))
          .flatMap((v) => v.formats)
      : options.formats
    ).map((f) => f.slug),
  );
}
export function reconcile<T extends { seatId: number; code: string }>(
  selected: T[],
  contested: string[],
) {
  return selected.filter((s) => !contested.includes(s.code));
}
export function readStored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
