import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Search, UserRound, ChevronDown } from "lucide-react";
import { useAuth } from "./Auth";
import { useDebounce, useMutation, useResource } from "../lib/hooks";
import type { Movie } from "../lib/types";
import { Empty, ErrorBox, Skeleton } from "./UI";
import { money } from "../lib/utils";

export function Header() {
  const auth = useAuth();
  const location = useLocation();
  const isHome = location.pathname === "/";

  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  const debounced = useDebounce(q);
  const root = useRef<HTMLElement>(null);
  const logout = useMutation();

  const search = useResource<Movie[]>(
    searchOpen && debounced.trim()
      ? `/search?q=${encodeURIComponent(debounced.trim())}`
      : null,
  );

  useEffect(() => {
    function outside(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) {
        setSearchOpen(false);
        setMenu(false);
      }
    }

    function key(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setMenu(false);
      }
    }

    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key);

    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", key);
    };
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setMenu(false);
    setQ("");
  }, [location.pathname, location.search]);

  function closeSearch() {
    setSearchOpen(false);
    setQ("");
  }

  async function handleLogout() {
    try {
      await logout.run(auth.logout);
      setMenu(false);
      closeSearch();
    } catch {
      // The mutation exposes the error in the account menu.
    }
  }

  return (
    <header
      ref={root}
      className={`header${isHome ? " kino-header-overlay" : ""}`}
    >
      <Link className="logo" to="/" aria-label="Kino XII home">
        KINO <span>XII</span>
      </Link>

      <nav aria-label="Main navigation">
        <NavLink to="/sessions">Sessions</NavLink>
      </nav>

      <div className="header-search">
        <Search size={18} aria-hidden="true" />

        <input
          type="search"
          aria-label="Search films and events"
          aria-expanded={searchOpen}
          aria-controls="header-search-results"
          autoComplete="off"
          placeholder="Search films and live events"
          value={q}
          onFocus={() => {
            setSearchOpen(true);
            setMenu(false);
          }}
          onChange={(event) => {
            setQ(event.target.value);
            setSearchOpen(true);
            setMenu(false);
          }}
        />

        {searchOpen && (
          <div
            id="header-search-results"
            className="search-popover"
          >
            {!q.trim() ? (
              <Empty
                title="What do you want to watch?"
                text="Search by title, director or cast."
                action={
                  <Link
                    className="secondary"
                    to="/sessions"
                    onClick={closeSearch}
                  >
                    Browse all sessions
                  </Link>
                }
              />
            ) : debounced !== q || search.loading ? (
              <Skeleton count={2} />
            ) : search.error ? (
              <ErrorBox
                error={search.error}
                retry={search.reload}
              />
            ) : !search.data?.length ? (
              <Empty
                title={`No results for “${q}”`}
                text="Check the spelling or try another film or event."
                action={
                  <Link to="/sessions" onClick={closeSearch}>
                    Browse all sessions
                  </Link>
                }
              />
            ) : (
              <>
                <div className="eyebrow eyebrow--split">
                  <span>FILMS & EVENTS</span>
                  <span>{search.data.length} results</span>
                </div>

                {search.data.map((movie) => (
                  <Link
                    className="search-result"
                    key={movie.id}
                    to={`/movies/${movie.slug}`}
                    onClick={closeSearch}
                  >
                    <img
                      src={
                        movie.posterUrl ||
                        "/poster-placeholder.svg"
                      }
                      alt=""
                    />

                    <div>
                      <strong>{movie.title}</strong>
                      <small>
                        {movie.ageRating.code} ·{" "}
                        {movie.runtimeMinutes} min
                      </small>
                    </div>

                    <small>
                      {movie.isComingSoon
                        ? "Coming Soon"
                        : `from ${money(movie.fromPrice)}`}
                    </small>
                  </Link>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {auth.booting ? (
        <span className="muted">Loading profile…</span>
      ) : auth.user ? (
        <div className="account">
          <button
            type="button"
            className="account-trigger"
            aria-expanded={menu}
            aria-controls="header-account-menu"
            onClick={() => {
              setMenu((current) => !current);
              setSearchOpen(false);
            }}
          >
            <span className="avatar tiny">
              {auth.user.avatar ? (
                <img src={auth.user.avatar} alt="" />
              ) : (
                <UserRound size={18} aria-hidden="true" />
              )}
            </span>

            {auth.user.username}

            <span
              className={`status-dot ${
                auth.user.profileComplete ? "complete" : ""
              }`}
              aria-hidden="true"
            />

            <ChevronDown size={14} aria-hidden="true" />
          </button>

          {menu && (
            <div
              id="header-account-menu"
              className="account-menu"
            >
              <strong>
                {auth.user.fullName || auth.user.username}
              </strong>

              <small>{auth.user.email}</small>

              <div
                className={`notice ${
                  auth.user.profileComplete
                    ? "success"
                    : "warning"
                }`}
              >
                {auth.user.profileComplete
                  ? "Profile Complete ✓"
                  : "Profile incomplete"}

                <small>
                  {auth.user.profileComplete
                    ? "You’re ready to book."
                    : "Finish your profile to enable booking."}
                </small>
              </div>

              <Link
                to="/profile"
                onClick={() => setMenu(false)}
              >
                My Profile
              </Link>

              <Link
                to="/profile/tickets"
                onClick={() => setMenu(false)}
              >
                My Tickets
              </Link>

              <button
                type="button"
                className="text-button"
                disabled={logout.busy}
                onClick={() => void handleLogout()}
              >
                {logout.busy ? "Logging out…" : "Log out"}
              </button>

              <ErrorBox
                error={logout.error}
                retry={() => void handleLogout()}
              />
            </div>
          )}
        </div>
      ) : (
        <>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setSearchOpen(false);
              auth.open("register");
            }}
          >
            Sign up
          </button>

          <button
            type="button"
            className={`secondary${
              isHome ? " kino-login-button" : ""
            }`}
            onClick={() => {
              setSearchOpen(false);
              auth.open("login");
            }}
          >
            Log in
          </button>
        </>
      )}
    </header>
  );
}


