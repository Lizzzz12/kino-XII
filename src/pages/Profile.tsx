import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { api, formData, post } from "../lib/api";
import { useAuth } from "../components/Auth";
import { useApp } from "../App";
import { useForm, useMutation, useResource } from "../lib/hooks";
import type { Order, User } from "../lib/types";
import {
  AvatarInput,
  Empty,
  ErrorBox,
  Field,
  Modal,
  Skeleton,
} from "../components/UI";
import { dateLabel, money } from "../lib/utils";
export function Profile({ tickets = false }: { tickets?: boolean }) {
  const auth = useAuth();
  if (auth.booting)
    return (
      <main className="container">
        <Skeleton />
      </main>
    );
  if (!auth.user)
    return (
      <main className="container">
        <Empty
          title="Your movie nights, in one place"
          text="Log in to manage your profile and tickets."
          action={
            <button className="primary" onClick={() => auth.open()}>
              Log in
            </button>
          }
        />
      </main>
    );
  return (
    <main className="container profile-page">
      <h1>My Profile</h1>
      <div className="profile-tabs">
        <NavLink to="/profile" end>
          Personal Information{" "}
          <span
            className={`status-dot ${auth.user.profileComplete ? "complete" : ""}`}
          />
        </NavLink>
        <NavLink to="/profile/tickets">My Tickets</NavLink>
      </div>
      {tickets ? <Tickets /> : <PersonalInformation key={auth.user.id} />}
    </main>
  );
}
function PersonalInformation() {
  const auth = useAuth();
  const user = auth.user!;
  const { options } = useApp();
  function initial() {
    return {
      fullName: user.fullName || "",
      email: user.email,
      mobileNumber: user.mobileNumber || "",
      dateOfBirth: user.dateOfBirth?.slice(0, 10) || "",
      preferredVenueId: String(user.preferredVenue?.id || ""),
      avatar: null,
    };
  }
  const form = useForm(initial(), [
    "fullName",
    "mobileNumber",
    "dateOfBirth",
    "avatar",
  ]);
  const mutation = useMutation();
  const [saved, setSaved] = useState(false);
  const [baseline, setBaseline] = useState(initial());
  const dirty = Object.keys(form.values).some(
    (k) => form.values[k] !== baseline[k as keyof typeof baseline],
  );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    form.touchAll();
    if (!form.valid || !dirty) return;
    try {
      await mutation.run(async () => {
        const result = await api<User>("/profile", {
          method: "PUT",
          body: formData({
            ...form.values,
            preferredVenueId: form.values.preferredVenueId || "",
          }),
        });
        auth.setUser(result.data);
        const next = {
          fullName: result.data.fullName || "",
          email: result.data.email,
          mobileNumber: result.data.mobileNumber || "",
          dateOfBirth: result.data.dateOfBirth?.slice(0, 10) || "",
          preferredVenueId: String(result.data.preferredVenue?.id || ""),
          avatar: null,
        };
        setBaseline(next);
        form.reset(next);
        setSaved(true);
      });
    } catch (e) {
      form.server(e);
    }
  }
  return (
    <section>
      {!user.profileComplete ? (
        <div className="notice warning">
          Please complete your profile to enable booking.
        </div>
      ) : (
        <div className="notice success">Profile Complete ✓</div>
      )}
      <form className="profile-form" onSubmit={submit}>
        <AvatarInput form={form} current={user.avatar} />
        <Field
          form={form}
          name="fullName"
          label="Full name"
          autoComplete="name"
        />
        <Field form={form} name="email" label="Email" type="email" disabled />
        <Field
          form={form}
          name="mobileNumber"
          label="Mobile number"
          type="tel"
          autoComplete="tel-national"
        />
        <Field
          form={form}
          name="dateOfBirth"
          label="Date of birth"
          type="date"
          autoComplete="bday"
        />
        <label className="field">
          <span>Preferred venue (optional)</span>
          <select
            value={String(form.values.preferredVenueId)}
            onChange={(e) => form.change("preferredVenueId", e.target.value)}
          >
            <option value="">No preference</option>
            {options?.venues.map((v) => (
              <option value={v.id} key={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        {user.age != null && (
          <p className="muted">
            You are {user.age}.{" "}
            {user.age >= 18
              ? "You can buy tickets for all age ratings."
              : `You cannot buy tickets for ${user.age < 16 ? "16+ or 18+" : "18+"} titles.`}
          </p>
        )}
        <ErrorBox error={mutation.error} />
        {saved && (
          <p className="success-text" role="status">
            Your changes have been saved.
          </p>
        )}
        <button
          className="primary"
          disabled={!dirty || !form.valid || mutation.busy}
        >
          {mutation.busy ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </section>
  );
}
function Tickets() {
  const [filter, setFilter] = useState<"upcoming" | "past">("upcoming");
  const resource = useResource<Order[]>(`/tickets?filter=${filter}`);
  const [refund, setRefund] = useState<Order | null>(null);
  const mutation = useMutation();
  useEffect(() => {
    const id = setInterval(resource.reload, 60000);
    return () => clearInterval(id);
  }, [resource.reload]);
  async function confirm() {
    if (!refund) return;
    try {
      await mutation.run(async () => {
        await post<Order>(`/orders/${refund.reference}/refund`);
        setRefund(null);
        resource.reload();
      });
    } catch {}
  }
  return (
    <section>
      <div className="tabs">
        <button
          className={filter === "upcoming" ? "active" : ""}
          onClick={() => setFilter("upcoming")}
        >
          Upcoming
        </button>
        <button
          className={filter === "past" ? "active" : ""}
          onClick={() => setFilter("past")}
        >
          Past
        </button>
      </div>
      {resource.loading ? (
        <Skeleton count={3} />
      ) : resource.error ? (
        <ErrorBox error={resource.error} retry={resource.reload} />
      ) : resource.data?.length ? (
        resource.data.map((order) => (
          <article className="ticket-card" key={order.id}>
            <img
              src={order.session.movie.posterUrl || "/poster-placeholder.svg"}
              alt={order.session.movie.title}
            />
            <div>
              <h3>{order.session.movie.title}</h3>
              <p>
                {order.session.venue.name} · Hall {order.session.hall.name}
              </p>
              <p>
                {dateLabel(order.session.date)} · {order.session.time} ·{" "}
                {order.session.format.name} · {order.session.language.name}
              </p>
              <p>
                {order.tickets
                  .map((t) => `${t.seatCode} (${t.ticketType.name})`)
                  .join(", ")}
              </p>
              <small>
                {order.reference} · {order.status}
              </small>
            </div>
            <div className="ticket-actions">
              <strong>{money(order.totalPrice)}</strong>
              {filter === "upcoming" && (
                <>
                  <button
                    className="secondary"
                    disabled={!order.isRefundable}
                    onClick={() => {
                      mutation.setError(null);
                      setRefund(order);
                    }}
                  >
                    Refund
                  </button>
                  {!order.isRefundable && (
                    <small>Refunds close 2 hours before the session.</small>
                  )}
                </>
              )}
            </div>
          </article>
        ))
      ) : (
        <Empty
          title={`No ${filter} tickets`}
          text={
            filter === "upcoming"
              ? "Your next cinema visit starts here."
              : "Past visits and refunded bookings will appear here."
          }
          action={
            <Link className="primary" to="/sessions">
              Browse sessions
            </Link>
          }
        />
      )}{" "}
      {refund && (
        <Modal title="Refund these tickets?" onClose={() => setRefund(null)}>
          <p>
            {refund.session.movie.title} ·{" "}
            {refund.tickets.map((t) => t.seatCode).join(", ")}
          </p>
          <p>
            The seats will be released and this booking will move to Past. This
            cannot be undone.
          </p>
          <strong>{money(refund.totalPrice)}</strong>
          <ErrorBox error={mutation.error} retry={() => void confirm()} />
          <div className="actions">
            <button
              className="secondary"
              disabled={mutation.busy}
              onClick={() => setRefund(null)}
            >
              Close
            </button>
            <button
              className="primary"
              disabled={mutation.busy}
              onClick={() => void confirm()}
            >
              {mutation.busy ? "Refunding…" : "Confirm refund"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
