import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Ticket } from "lucide-react";
import { useResource } from "../lib/hooks";
import type { Movie } from "../lib/types";
import { MovieCard, Meta } from "../components/Movies";
import { Empty, ErrorBox, Skeleton } from "../components/UI";
import { readStored } from "../lib/utils";

export function Home() {
  const featured = useResource<Movie[]>("/movies/featured");
  const now = useResource<Movie[]>("/movies/now-playing");
  const soon = useResource<Movie[]>("/movies/coming-soon");

  const [index, setIndex] = useState(0);
  const [recent, setRecent] = useState<Movie[]>(() =>
    readStored<Movie[]>("kino-recent", []),
  );

  const slides = featured.data ?? [];
  const slideCount = slides.length;
  const activeIndex = slideCount > 0 ? index % slideCount : 0;
  const hero = slides[activeIndex];

  function moveSlide(direction: number) {
    if (slideCount < 2) return;

    setIndex((current) => {
      const currentIndex = current % slideCount;
      return (currentIndex + direction + slideCount) % slideCount;
    });
  }

  function clearHistory() {
    localStorage.removeItem("kino-recent");
    setRecent([]);
  }

  return (
    <div className="kino-home">
      <section
        className="kino-home-hero"
        aria-label="Featured movies"
        aria-roledescription="carousel"
      >
        {hero && (
          <img
            className="kino-hero-backdrop"
            src={hero.backdropUrl ?? undefined}
            alt=""
          />
        )}

        <div className="kino-hero-shade" aria-hidden="true" />

        <div className="kino-hero-inner">
          {featured.loading ? (
            <div className="kino-hero-status">
              <Skeleton count={1} />
            </div>
          ) : featured.error ? (
            <div className="kino-hero-status">
              <ErrorBox
                error={featured.error}
                retry={featured.reload}
              />
            </div>
          ) : hero ? (
            <div
              className="kino-hero-copy"
              key={hero.id}
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="kino-premiere-label">
                {hero.isComingSoon ? "COMING SOON" : "NOW SHOWING"}
              </span>

              <h1>{hero.title}</h1>

              <Meta movie={hero} />

              <p>{hero.synopsis}</p>

              <div className="kino-hero-actions">
                <Link
                  className="primary"
                  to={`/movies/${hero.slug}`}
                >
                  <Ticket size={18} aria-hidden="true" />
                  {hero.isComingSoon ? "View details" : "Buy tickets"}
                </Link>

                <Link className="secondary" to="/sessions">
                  All sessions
                </Link>
              </div>
            </div>
          ) : (
            <div className="kino-hero-status">
              <Empty text="No featured titles are available right now." />
            </div>
          )}
        </div>

        {!featured.loading && !featured.error && slideCount > 0 && (
          <div className="kino-carousel-controls">
            <div
              className="kino-carousel-bars"
              role="group"
              aria-label="Choose a featured movie"
            >
              {slides.map((movie, slideIndex) => (
                <button
                  key={movie.id}
                  type="button"
                  className={
                    activeIndex === slideIndex ? "active" : ""
                  }
                  aria-label={`Show ${movie.title}`}
                  aria-pressed={activeIndex === slideIndex}
                  onClick={() => setIndex(slideIndex)}
                />
              ))}
            </div>

            <div className="kino-carousel-arrows">
              <button
                type="button"
                aria-label="Previous featured movie"
                disabled={slideCount < 2}
                onClick={() => moveSlide(-1)}
              >
                <ChevronLeft size={24} aria-hidden="true" />
              </button>

              <button
                type="button"
                aria-label="Next featured movie"
                disabled={slideCount < 2}
                onClick={() => moveSlide(1)}
              >
                <ChevronRight size={24} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="container kino-home-content">
        {recent.length > 0 && (
          <section>
            <div className="section-heading">
              <h2>Recently Viewed</h2>

              <button
                type="button"
                className="text-button"
                onClick={clearHistory}
              >
                Clear history
              </button>
            </div>

            <div className="recent-grid">
              {recent.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  compact
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="section-heading">
            <h2>Now Playing</h2>
            <Link to="/sessions">See all →</Link>
          </div>

          {now.loading ? (
            <Skeleton count={6} />
          ) : now.error ? (
            <ErrorBox error={now.error} retry={now.reload} />
          ) : now.data?.length ? (
            <div className="movie-grid">
              {now.data.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          ) : (
            <Empty text="No films are currently showing. Check back soon." />
          )}
        </section>

        <section>
          <div className="section-heading">
            <h2>Coming Soon</h2>
          </div>

          {soon.loading ? (
            <Skeleton count={4} />
          ) : soon.error ? (
            <ErrorBox error={soon.error} retry={soon.reload} />
          ) : soon.data?.length ? (
            <div className="movie-grid">
              {soon.data.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  compact
                />
              ))}
            </div>
          ) : (
            <Empty text="New releases will appear here." />
          )}
        </section>
      </div>
    </div>
  );
}


