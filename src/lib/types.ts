export interface Format {
  id: number;
  slug: string;
  name: string;
  priceUplift: number;
}
export interface Venue {
  id: number;
  slug: string;
  name: string;
  city: string;
  formats: Format[];
}
export interface Language {
  id: number;
  slug: string;
  name: string;
  code: string;
}
export interface TicketType {
  id: number;
  slug: string;
  name: string;
  priceRatio: number;
  note: string | null;
  blockedFromRatingAge: number | null;
}
export interface Movie {
  id: number;
  slug: string;
  title: string;
  kind: "film" | "event";
  runtimeMinutes: number;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string;
  isComingSoon: boolean;
  isNotified?: boolean;
  fromPrice: number;
  ageRating: { code: string; minAge: number; description: string };
  genres: { id: number; name: string; slug: string }[];
  formats: Format[];
  synopsis?: string;
  director?: string;
  cast?: string;
  availableDates?: string[];
}
export interface User {
  id: number;
  username: string;
  email: string;
  avatar: string | null;
  fullName: string | null;
  mobileNumber: string | null;
  dateOfBirth: string | null;
  age: number | null;
  preferredVenue: Venue | null;
  profileComplete: boolean;
}
export interface Session {
  id: number;
  startsAt: string;
  date: string;
  time: string;
  timeBand: string;
  price: number;
  seatsLeft: number;
  isSoldOut: boolean;
  hall: { id: number; name: string };
  venue: Venue;
  format: Format;
  language: Language;
  movie: Movie;
}
export interface Seat {
  id: number;
  code: string;
  label: string;
  state: "available" | "sold" | "held" | "unavailable";
  aisleAfter: boolean;
  isMine: boolean;
}
export interface SeatMap {
  sessionId: number;
  hall: Session["hall"] & { venue: Venue };
  sections: { name: string; rows: { label: string; seats: Seat[] }[] }[];
}
export interface Hold {
  holdId: string;
  sessionId: number;
  expiresAt: string;
  isLive: boolean;
  secondsRemaining: number;
  subtotal: number;
  seats: {
    seatId: number;
    code: string;
    ticketType: { slug: string; name: string };
    price: number;
  }[];
}
export interface Order {
  id: number;
  reference: string;
  status: "paid" | "refunded";
  totalPrice: number;
  paidAt: string;
  refundedAt: string | null;
  isUpcoming: boolean;
  isRefundable: boolean;
  cardLastFour: string;
  contact: { fullName: string; email: string; mobileNumber: string };
  session: Session;
  tickets: {
    id: number;
    seatCode: string;
    ticketType: { slug: string; name: string };
    price: number;
  }[];
}
export interface Options {
  venues: Venue[];
  formats: Format[];
  languages: Language[];
  timeBands: { id: string; label: string }[];
  sorts: { id: string; label: string }[];
  ticketTypes: TicketType[];
  maxSeatsPerOrder: number;
  holdMinutes: number;
}
export interface Response<T> {
  data: T;
  meta?: {
    currentPage: number;
    lastPage: number;
    totalSessions: number;
    totalMovies: number;
    date: string;
  };
}
