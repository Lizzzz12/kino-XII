import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useResource } from "../lib/hooks";
import { api, post } from "../lib/api";
import type { Movie, Session, Venue } from "../lib/types";
import { Meta, SessionButton } from "../components/Movies";
import { useAuth } from "../components/Auth";
import { Empty, ErrorBox, Skeleton } from "../components/UI";
import { dateLabel, readStored, today } from "../lib/utils";
import { useApp } from "../App";
export function MovieDetail() {
  const { slug } = useParams();
  const movie = useResource<Movie>(`/movies/${slug}`);
  const [date, setDate] = useState("");
  const [notified, setNotified] = useState(false);
  const { book } = useApp();
  const auth = useAuth();
  const mutation = useMutation();
  useEffect(() => {
    setDate("");
    setNotified(false);
  }, [slug]);
  useEffect(() => {
    if (!movie.data) return;
    const m = movie.data;
    const dates = m.availableDates || [];
    setDate(dates.includes(today()) ? today() : dates[0] || today());
    const recent = readStored<Movie[]>("kino-recent", []);
    localStorage.setItem(
      "kino-recent",
      JSON.stringify([m, ...recent.filter((r) => r.id !== m.id)].slice(0, 4)),
    );
    setNotified(!!m.isNotified);
  }, [movie.data]);
  const sessions = useResource<{ venue: Venue; sessions: Session[] }[]>(
    movie.data && !movie.data.isComingSoon && date
      ? `/movies/${slug}/sessions?date=${date}`
      : null,
  );
  if (movie.loading)
    return (
      <main className="container">
        <Skeleton />
      </main>
    );
  if (movie.error)
    return (
      <main className="container">
        <ErrorBox error={movie.error} retry={movie.reload} />
      </main>
    );
  const m = movie.data;
  if (!m) return null;
  async function notify() {
    await auth.ensure(async () => {
      try {
        await mutation.run(async () => {
          await post(`/movies/${slug}/notify`);
          const updated = (await api<Movie>(`/movies/${slug}`)).data;
          setNotified(!!updated.isNotified);
          movie.reload();
        });
      } catch {}
    }, false);
  }
  return (
    <>
      <section
        className="detail-hero"
        style={{
          backgroundImage: `linear-gradient(90deg,rgba(8,12,27,.9),rgba(8,12,27,.3)),linear-gradient(0deg,#080c1b,transparent),url("${m.backdropUrl}")`,
        }}
      >
        <div className="container detail-heading">
          <img
            src={m.posterUrl || "/poster-placeholder.svg"}
            alt={`${m.title} poster`}
          />
          <div>
            <span className="eyebrow">
              {m.kind === "event" ? "SPECIAL EVENT" : "NOW IN CINEMAS"}
            </span>
            <h1>{m.title}</h1>
            <Meta movie={m} />
          </div>
        </div>
      </section>
      <main className="container detail-layout">
        <section>
          {m.isComingSoon ? (
            <>
              <h2>Coming Soon</h2>
              <p>
                In cinemas {dateLabel(m.releaseDate)}. Be the first to hear when
                tickets go on sale.
              </p>
              <button
                className="primary"
                disabled={mutation.busy || notified}
                onClick={() => void notify()}
              >
                {mutation.busy
                  ? "Subscribing…"
                  : notified
                    ? "Notification enabled ✓"
                    : "Notify me"}
              </button>
              <ErrorBox error={mutation.error} retry={() => void notify()} />
            </>
          ) : (
            <>
              <h2>Choose a session</h2>
              <div className="date-picker">
                {m.availableDates?.map((d) => (
                  <button
                    key={d}
                    className={date === d ? "active" : ""}
                    onClick={() => setDate(d)}
                  >
                    {dateLabel(d)}
                  </button>
                ))}
              </div>
              {auth.user?.age != null && auth.user.age < m.ageRating.minAge && (
                <div className="notice warning">
                  This title is restricted to viewers aged {m.ageRating.minAge}{" "}
                  and over.
                </div>
              )}
              {sessions.loading ? (
                <Skeleton count={3} />
              ) : sessions.error ? (
                <ErrorBox error={sessions.error} retry={sessions.reload} />
              ) : sessions.data?.length ? (
                sessions.data.map((g) => (
                  <div className="venue-sessions" key={g.venue.id}>
                    <h3>{g.venue.name}</h3>
                    <div className="session-grid">
                      {g.sessions.map((s) => (
                        <SessionButton
                          key={s.id}
                          session={s}
                          movie={m}
                          onBook={book}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <Empty
                  title="No sessions on this date"
                  text="Choose another available date or check back later."
                />
              )}
            </>
          )}
        </section>
        <aside className="synopsis">
          <h3>Synopsis</h3>
          <p>{m.synopsis}</p>
          <h4>Director</h4>
          <p>{m.director || "Not provided"}</p>
          <h4>Cast</h4>
          <p>{m.cast || "Not provided"}</p>
          <h4>Age rating</h4>
          <p>{m.ageRating.description}</p>
        </aside>
      </main>
    </>
  );
}
