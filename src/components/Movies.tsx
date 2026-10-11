import { Link } from "react-router-dom";
import type { Movie, Session } from "../lib/types";
import { money } from "../lib/utils";
import { useAuth } from "./Auth";
export function Meta({ movie }: { movie: Movie }) {
  return (
    <div className="movie-meta">
      <span className="badge" title={movie.ageRating.description}>
        {movie.ageRating.code}
      </span>
      <span>{movie.genres?.map((g) => g.name).join(" · ")}</span>
      <span>{movie.runtimeMinutes} min</span>
      {movie.formats?.map((f) => (
        <span className="badge" key={f.id}>
          {f.name}
        </span>
      ))}
    </div>
  );
}
export function MovieCard({
  movie,
  compact = false,
}: {
  movie: Movie;
  compact?: boolean;
}) {
  return (
    <article className={`movie-card ${compact ? "compact" : ""}`}>
      <Link className="poster" to={`/movies/${movie.slug}`}>
        <img
          src={movie.posterUrl || "/poster-placeholder.svg"}
          alt={`${movie.title} poster`}
          loading="lazy"
        />
        <span
          className="badge poster-rating"
          title={movie.ageRating.description}
        >
          {movie.ageRating.code}
        </span>
      </Link>
      <div className="card-body">
        <Link to={`/movies/${movie.slug}`}>
          <h3>{movie.title}</h3>
        </Link>
        <Meta movie={movie} />
        {!compact && movie.synopsis && <p>{movie.synopsis}</p>}
        <div className="card-bottom">
          <span>
            {movie.isComingSoon
              ? "Coming Soon"
              : `from ${money(movie.fromPrice)}`}
          </span>
          <Link
            className={movie.isComingSoon ? "secondary" : "primary"}
            to={`/movies/${movie.slug}`}
          >
            {movie.isComingSoon ? "Details" : "Buy tickets"}
          </Link>
        </div>
      </div>
    </article>
  );
}
export function SessionButton({
  session,
  movie,
  onBook,
}: {
  session: Session;
  movie: Movie;
  onBook: (id: number) => void;
}) {
  const { user } = useAuth();
  const ageBlocked = user?.age != null && user.age < movie.ageRating.minAge;
  const started = Date.parse(session.startsAt) <= Date.now();
  const disabled = session.isSoldOut || ageBlocked || started;
  const reason = ageBlocked
    ? `You must be ${movie.ageRating.minAge}+ to book this title`
    : started
      ? "This session has already started"
      : session.isSoldOut
        ? "Sold out"
        : `${session.seatsLeft} seats available`;
  return (
    <button
      className="session-button"
      disabled={disabled}
      title={reason}
      onClick={() => onBook(session.id)}
    >
      <strong>{session.time}</strong>
      <div>
        <span className="badge">{session.format.name}</span>
        <span className="badge" title={session.language.name}>
          {session.language.code}
        </span>
      </div>
      <small>
        Hall {session.hall.name} · {money(session.price)}
      </small>
      <small className={disabled ? "muted" : "accent"}>
        {disabled ? reason : `${session.seatsLeft} seats left`}
      </small>
    </button>
  );
}
