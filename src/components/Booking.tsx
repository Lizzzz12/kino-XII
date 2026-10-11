import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { api, ApiError, post } from "../lib/api";
import type { Hold, Order, Seat, SeatMap, Session } from "../lib/types";
import { useForm, useMutation, useResource } from "../lib/hooks";
import { dateLabel, money, reconcile, remaining } from "../lib/utils";
import { useAuth } from "./Auth";
import { ErrorBox, Field, Modal, Skeleton } from "./UI";
import { useApp } from "../App";
type Selection = { seatId: number; code: string; ticketType: string };
export function Booking({
  sessionId,
  onClose,
}: {
  sessionId: number;
  onClose: () => void;
}) {
  const { options } = useApp();
  const auth = useAuth();
  const location = useLocation();
  const session = useResource<Session>(`/sessions/${sessionId}`);
  const map = useResource<SeatMap>(`/sessions/${sessionId}/seats`);
  const [selected, setSelected] = useState<Selection[]>([]);
  const [hold, setHold] = useState<Hold | null>(null);
  const [step, setStep] = useState<"seats" | "checkout" | "confirmed">("seats");
  const [order, setOrder] = useState<Order | null>(null);
  const [warning, setWarning] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [restoring, setRestoring] = useState(false);
  const mutation = useMutation();
  const holdRef = useRef<Hold | null>(null);
  holdRef.current = hold;
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const form = useForm(
    {
      fullName: auth.user?.fullName || "",
      email: auth.user?.email || "",
      mobileNumber: auth.user?.mobileNumber || "",
      cardNumber: "",
      expiry: "",
      cvv: "",
    },
    ["fullName", "email", "mobileNumber", "cardNumber", "expiry", "cvv"],
  );
  useEffect(() => {
    if (auth.user) {
      form.change("fullName", auth.user.fullName || "");
      form.change("email", auth.user.email);
      form.change("mobileNumber", auth.user.mobileNumber || "");
    }
  }, [
    auth.user?.id,
    auth.user?.fullName,
    auth.user?.email,
    auth.user?.mobileNumber,
  ]);
  function clearSaved() {
    sessionStorage.removeItem("kino-booking");
  }
  const close = useCallback(() => {
    const current = holdRef.current;
    if (current) {
      void api(`/holds/${current.holdId}`, { method: "DELETE" }).catch(
        () => {},
      );
      clearSaved();
    }
    onClose();
  }, [onClose]);
  useEffect(() => {
    const raw = sessionStorage.getItem("kino-booking");
    if (!raw) return;
    let saved: { sessionId: number; holdId: string };
    try {
      saved = JSON.parse(raw);
    } catch {
      clearSaved();
      return;
    }
    if (saved.sessionId !== sessionId) return;
    let active = true;
    setRestoring(true);
    api<Hold>(`/holds/${saved.holdId}`)
      .then((r) => {
        if (!active) return;
        if (r.data.isLive && remaining(r.data.expiresAt) > 0) {
          setHold(r.data);
          setSeconds(remaining(r.data.expiresAt));
          setSelected(
            r.data.seats.map((s) => ({
              seatId: s.seatId,
              code: s.code,
              ticketType: s.ticketType.slug,
            })),
          );
          setStep("checkout");
        } else {
          setWarning("Your hold time expired. Please re-select your seats.");
          clearSaved();
          map.reload();
        }
      })
      .catch((e) => {
        if (active) {
          setWarning(e.message);
          if ([403, 404].includes(e.status)) clearSaved();
        }
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [sessionId]);
  useEffect(() => {
    if (!hold || step === "confirmed") return;
    function tick() {
      const time = remaining(hold!.expiresAt);
      setSeconds(time);
      if (!time) {
        setHold(null);
        setSelected([]);
        setStep("seats");
        setWarning("Your hold time expired. Please re-select your seats.");
        clearSaved();
        map.reload();
      }
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [hold, step]);
  const holdMatchesSelection =
    !!hold &&
    hold.seats.length === selected.length &&
    hold.seats.every((s) =>
      selected.some(
        (x) => x.seatId === s.seatId && x.ticketType === s.ticketType.slug,
      ),
    );
  const allowedTypes =
    options?.ticketTypes.filter(
      (t) =>
        t.blockedFromRatingAge === null ||
        (session.data?.movie.ageRating.minAge || 0) < t.blockedFromRatingAge,
    ) || [];
  const total = selected.reduce(
    (sum, s) =>
      sum +
      (session.data?.price || 0) *
        (options?.ticketTypes.find((t) => t.slug === s.ticketType)
          ?.priceRatio || 1),
    0,
  );
  function toggle(seat: Seat) {
    setWarning("");
    if (selected.some((s) => s.seatId === seat.id)) {
      setSelected((s) => s.filter((x) => x.seatId !== seat.id));
      return;
    }
    if (selected.length >= (options?.maxSeatsPerOrder || 3)) {
      setWarning(
        `Choose up to ${options?.maxSeatsPerOrder || 3} seats per order.`,
      );
      return;
    }
    setSelected((s) => [
      ...s,
      { seatId: seat.id, code: seat.code, ticketType: "adult" },
    ]);
  }
  async function recover(e: unknown) {
    const error = e as ApiError;
    form.server(e);
    if (error.status === 409) {
      const contested = error.body.contested || [];
      setSelected((s) => reconcile(s, contested));
      setWarning(
        `These seats were just taken: ${contested.join(", ")}. Your other choices have been kept.`,
      );
      setStep("seats");
      map.reload();
      if (hold) {
        try {
          const latest = (await api<Hold>(`/holds/${hold.holdId}`)).data;
          if (!latest.isLive) {
            setHold(null);
            clearSaved();
          }
        } catch {
          setHold(null);
          clearSaved();
        }
      }
    } else if (
      error.status === 422 &&
      !error.body.errors &&
      error.message.toLowerCase().includes("expired")
    ) {
      setHold(null);
      setSelected([]);
      setStep("seats");
      clearSaved();
      setWarning(error.message);
      map.reload();
    } else setWarning(error.message);
  }
  async function next() {
    if (!selected.length) return;
    await auth.ensure(async () => {
      try {
        await mutation.run(async () => {
          const r = await post<Hold>(`/sessions/${sessionId}/holds`, {
            seats: selected.map(({ seatId, ticketType }) => ({
              seatId,
              ticketType,
            })),
          });
          if (!mounted.current) {
            await api(`/holds/${r.data.holdId}`, { method: "DELETE" });
            return;
          }
          setHold(r.data);
          setSeconds(remaining(r.data.expiresAt));
          setWarning("");
          sessionStorage.setItem(
            "kino-booking",
            JSON.stringify({ sessionId, holdId: r.data.holdId }),
          );
          setStep("checkout");
        });
      } catch (e) {
        await recover(e);
      }
    });
  }
  async function pay(e: React.FormEvent) {
    e.preventDefault();
    form.touchAll();
    if (!form.valid || !hold || seconds <= 0) return;
    try {
      await mutation.run(async () => {
        const r = await post<Order>("/orders", {
          ...form.values,
          holdId: hold.holdId,
        });
        setOrder(r.data);
        setStep("confirmed");
        setHold(null);
        clearSaved();
        form.change("cardNumber", "");
        form.change("cvv", "");
        form.change("expiry", "");
        setWarning("");
      });
    } catch (e) {
      await recover(e);
    }
  }
  if (
    auth.user &&
    !auth.user.profileComplete &&
    location.pathname === "/profile"
  )
    return null;
  if (step === "confirmed" && order) {
    return <BookingConfirmation order={order} onClose={close} />;
  }

  return (
    <Modal
      title={
        order
          ? "Booking confirmed"
          : session.data?.movie.title || "Choose your seats"
      }
      onClose={close}
      wide
    >
      {session.loading || map.loading || restoring ? (
        <Skeleton count={2} />
      ) : session.error ? (
        <ErrorBox error={session.error} retry={session.reload} />
      ) : map.error ? (
        <ErrorBox error={map.error} retry={map.reload} />
      ) : (
        session.data && (
          <>
            <div className="booking-meta">
              {session.data.venue.name} · Hall {session.data.hall.name} ·{" "}
              {dateLabel(session.data.date)} {session.data.time} ·{" "}
              {session.data.format.name} · {session.data.language.name}
              {hold && (
                <span className={`timer ${seconds < 60 ? "urgent" : ""}`}>
                  Seats held {Math.floor(seconds / 60)}:
                  {String(seconds % 60).padStart(2, "0")}
                </span>
              )}
            </div>
            <ErrorBox
              error={warning}
              retry={
                mutation.error
                  ? () => {
                      if (step === "seats") void next();
                      else
                        document.getElementById("checkout-form")?.dispatchEvent(
                          new Event("submit", {
                            bubbles: true,
                            cancelable: true,
                          }),
                        );
                    }
                  : undefined
              }
            />

            <>
              <div className="step-tabs">
                <button
                  className={step === "seats" ? "active" : ""}
                  disabled={mutation.busy}
                  onClick={() => {
                    setStep("seats");
                    map.reload();
                  }}
                >
                  1 · Seats
                </button>
                <button
                  className={step === "checkout" ? "active" : ""}
                  disabled={!holdMatchesSelection || mutation.busy}
                  onClick={() => setStep("checkout")}
                >
                  2 · Checkout
                </button>
              </div>
              <div className="booking-layout">
                <section>
                  {step === "seats" ? (
                    <>
                      <div className="screen">SCREEN</div>
                      <div className="seat-map">
                        {map.data?.sections.map((section) => (
                          <div className="seat-section" key={section.name}>
                            <h4>{section.name}</h4>
                            {section.rows.map((row) => (
                              <div className="seat-row" key={row.label}>
                                <span className="row-label">{row.label}</span>
                                {row.seats.map((seat) => (
                                  <Fragment key={seat.id}>
                                    {seat.state === "unavailable" ? (
                                      <span className="seat-gap" />
                                    ) : (
                                      <button
                                        className={`seat ${selected.some((s) => s.seatId === seat.id) ? "selected" : seat.state}`}
                                        disabled={
                                          mutation.busy ||
                                          (!seat.isMine &&
                                            seat.state !== "available")
                                        }
                                        aria-label={`Seat ${seat.code}, ${seat.state}`}
                                        aria-pressed={selected.some(
                                          (s) => s.seatId === seat.id,
                                        )}
                                        title={`${seat.code} · ${seat.state}`}
                                        onClick={() => toggle(seat)}
                                      >
                                        {seat.label}
                                      </button>
                                    )}
                                    {seat.aisleAfter && (
                                      <span className="aisle" />
                                    )}
                                  </Fragment>
                                ))}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                      <div className="legend">
                        <span>□ Available</span>
                        <span className="accent">■ Selected</span>
                        <span>▨ Sold</span>
                        <span className="held-text">
                          ▧ Held by another guest
                        </span>
                      </div>
                      <button
                        className="text-button"
                        disabled={mutation.busy}
                        onClick={map.reload}
                      >
                        Refresh availability
                      </button>
                    </>
                  ) : (
                    <form id="checkout-form" onSubmit={pay}>
                      <h3>Contact details</h3>
                      <Field
                        form={form}
                        name="fullName"
                        label="Full name"
                        autoComplete="name"
                      />
                      <div className="two-columns">
                        <Field
                          form={form}
                          name="email"
                          label="Email"
                          type="email"
                          autoComplete="email"
                        />
                        <Field
                          form={form}
                          name="mobileNumber"
                          label="Mobile number"
                          type="tel"
                          autoComplete="tel-national"
                        />
                      </div>
                      <h3>Payment details</h3>
                      <p className="notice">
                        Payment is simulated. Use 4242 4242 4242 4242, a future
                        expiry, and any 3-digit CVV.
                      </p>
                      <Field
                        form={form}
                        name="cardNumber"
                        label="Card number"
                        placeholder="4242 4242 4242 4242"
                        autoComplete="off"
                      />
                      <div className="two-columns">
                        <Field
                          form={form}
                          name="expiry"
                          label="Expiry (MM/YY)"
                          placeholder="09/30"
                          autoComplete="off"
                        />
                        <Field
                          form={form}
                          name="cvv"
                          label="CVV"
                          type="password"
                          autoComplete="off"
                        />
                      </div>
                    </form>
                  )}
                </section>
                <aside className="booking-summary">
                  <h3>Your seats · Max {options?.maxSeatsPerOrder || 3}</h3>
                  <p className="muted">
                    Pick up to three seats. Choose a ticket type for each seat.
                  </p>
                  {step === "checkout"
                    ? hold?.seats.map((s) => (
                        <div className="selection-item" key={s.seatId}>
                          <strong>{s.code}</strong>
                          <span>{s.ticketType.name}</span>
                          <strong>{money(s.price)}</strong>
                        </div>
                      ))
                    : selected.map((s) => (
                        <div className="selection-item" key={s.seatId}>
                          <strong>{s.code}</strong>
                          <select
                            aria-label={`Ticket type for ${s.code}`}
                            value={s.ticketType}
                            disabled={mutation.busy}
                            onChange={(e) =>
                              setSelected((prev) =>
                                prev.map((x) =>
                                  x.seatId === s.seatId
                                    ? { ...x, ticketType: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          >
                            {allowedTypes.map((t) => (
                              <option key={t.slug} value={t.slug}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                          <button
                            className="icon-button"
                            aria-label={`Remove seat ${s.code}`}
                            onClick={() =>
                              setSelected((prev) =>
                                prev.filter((x) => x.seatId !== s.seatId),
                              )
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                  {selected.some((s) => s.ticketType === "student") && (
                    <small className="muted">
                      {
                        options?.ticketTypes.find((t) => t.slug === "student")
                          ?.note
                      }
                    </small>
                  )}
                  <div className="subtotal">
                    <span>SUBTOTAL</span>
                    <strong>
                      {money(step === "checkout" ? hold?.subtotal || 0 : total)}
                    </strong>
                  </div>
                  {step === "seats" ? (
                    <button
                      className="primary full"
                      disabled={!selected.length || mutation.busy || !options}
                      onClick={() => void next()}
                    >
                      {mutation.busy ? "Reserving…" : "Next: Checkout"}
                    </button>
                  ) : (
                    <>
                      <button
                        className="primary full"
                        type="submit"
                        form="checkout-form"
                        disabled={!form.valid || mutation.busy || seconds <= 0}
                      >
                        {mutation.busy
                          ? "Processing…"
                          : `Pay ${money(hold?.subtotal || 0)}`}
                      </button>
                      <button
                        className="text-button full"
                        disabled={mutation.busy}
                        onClick={() => {
                          setStep("seats");
                          map.reload();
                        }}
                      >
                        Back to seats
                      </button>
                    </>
                  )}
                  <button className="text-button full" onClick={close}>
                    Close
                  </button>
                </aside>
              </div>
            </>
          </>
        )
      )}
    </Modal>
  );
}

function BookingConfirmation({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const ticketCounts = new Map<string, number>();
  order.tickets.forEach(({ ticketType }) => {
    ticketCounts.set(
      ticketType.name,
      (ticketCounts.get(ticketType.name) || 0) + 1,
    );
  });
  const ticketSummary = [...ticketCounts]
    .map(([name, count]) => `${count} × ${name}`)
    .join(", ");

  return (
    <div className="booking-confirmation-surface">
      <Modal title="Booking confirmed!" onClose={onClose} wide>
        <div className="booking-success">
          <span className="booking-success-icon" aria-hidden="true">
            <Check size={32} strokeWidth={3} />
          </span>
          <h2>Booking confirmed!</h2>
          <p className="booking-success-description">
            Your tickets are ready. You can find your booking
            <br />
            in My Tickets.
          </p>
          <span className="booking-order-reference">
            ORDER {order.reference}
          </span>

          <section className="booking-receipt" aria-label="Booking summary">
            <div className="booking-receipt-movie">
              <img
                src={order.session.movie.posterUrl || "/poster-placeholder.svg"}
                alt={`${order.session.movie.title} poster`}
              />
              <div>
                <h3>{order.session.movie.title}</h3>
                <p>
                  {order.session.venue.name} · Hall {order.session.hall.name} ·{" "}
                  {dateLabel(order.session.date)} · {order.session.time}
                </p>
              </div>
            </div>
            <dl className="booking-receipt-details">
              <div>
                <dt>Seats</dt>
                <dd>
                  {order.tickets.map((ticket) => ticket.seatCode).join(", ")}
                </dd>
              </div>
              <div>
                <dt>Tickets</dt>
                <dd>{ticketSummary}</dd>
              </div>
              <div className="booking-receipt-total">
                <dt>TOTAL PAID</dt>
                <dd>{money(order.totalPrice)}</dd>
              </div>
            </dl>
          </section>

          <div className="booking-success-actions">
            <Link className="primary" to="/profile/tickets" onClick={onClose}>
              View my tickets
            </Link>
            <Link className="secondary" to="/" onClick={onClose}>
              Back to home
            </Link>
          </div>
        </div>
      </Modal>
    </div>
  );
}


