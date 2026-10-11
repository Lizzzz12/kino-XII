import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDebounce, useResource } from "../lib/hooks";
import type { Movie, Session } from "../lib/types";
import { useApp } from "../App";
import { Meta, SessionButton } from "../components/Movies";
import { Empty, ErrorBox, Skeleton } from "../components/UI";
import { allowedFormats, today } from "../lib/utils";
export function Sessions() {
  const { options, book } = useApp();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const debounced = useDebounce(search);
  useEffect(
    () => setSearch(params.get("search") || ""),
    [params.get("search")],
  );
  function update(key: string, value: string | string[]) {
    const next = new URLSearchParams(params);
    next.delete(key);
    if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
    else if (value) next.set(key, value);
    if (key !== "page") next.set("page", "1");
    if (key === "venues[]" && options) {
      const allowed = allowedFormats(
        options,
        Array.isArray(value) ? value : [],
      );
      const formats = next.getAll("formats[]").filter((f) => allowed.has(f));
      next.delete("formats[]");
      formats.forEach((f) => next.append("formats[]", f));
    }
    setParams(next);
  }
  useEffect(() => {
    if (debounced !== (params.get("search") || "")) update("search", debounced);
  }, [debounced]);
  const query = new URLSearchParams(params);
  if (!query.has("date")) query.set("date", today());
  const resource = useResource<{ movie: Movie; sessions: Session[] }[]>(
    `/sessions?${query.toString()}`,
  );
  const selectedVenues = params.getAll("venues[]");
  const available = options
    ? allowedFormats(options, selectedVenues)
    : new Set<string>();
  function checks(key: string, items: { slug: string; name: string }[]) {
    const selected = params.getAll(key);
    return items.map((item) => (
      <label className="check" key={item.slug}>
        <input
          type="checkbox"
          checked={selected.includes(item.slug)}
          onChange={() =>
            update(
              key,
              selected.includes(item.slug)
                ? selected.filter((v) => v !== item.slug)
                : [...selected, item.slug],
            )
          }
        />
        {item.name}
      </label>
    ));
  }
  return (
    <main className="container">
      <h1>Sessions</h1>
      <div className="sessions-layout">
        <aside className="filters">
          <div className="section-heading">
            <h3>Filters</h3>
            <button
              className="text-button"
              onClick={() => {
                setSearch("");
                setParams({ date: today() });
              }}
            >
              Reset
            </button>
          </div>
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              min={today()}
              value={params.get("date") || today()}
              onChange={(e) => update("date", e.target.value)}
            />
          </label>
          <h4>Venue</h4>
          {checks("venues[]", options?.venues || [])}
          <h4>Format</h4>
          {checks(
            "formats[]",
            options?.formats.filter((f) => available.has(f.slug)) || [],
          )}
          <h4>Language</h4>
          {checks("languages[]", options?.languages || [])}
          <h4>Time of day</h4>
          {checks(
            "bands[]",
            options?.timeBands.map((b) => ({ slug: b.id, name: b.label })) ||
              [],
          )}
        </aside>
        <section>
          <div className="session-controls">
            <label className="field">
              <span>Search titles</span>
              <input
                placeholder="Search films or events"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Sort by</span>
              <select
                value={params.get("sort") || "time_asc"}
                onChange={(e) => update("sort", e.target.value)}
              >
                {options?.sorts.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted">
            {resource.loading
              ? "Loading sessions…"
              : `Showing ${resource.meta?.totalSessions || 0} sessions`}
          </p>
          {resource.loading ? (
            <Skeleton count={4} />
          ) : resource.error ? (
            <ErrorBox error={resource.error} retry={resource.reload} />
          ) : resource.data?.length ? (
            resource.data.map((group) => (
              <article className="session-row" key={group.movie.id}>
                <Link to={`/movies/${group.movie.slug}`}>
                  <img
                    className="session-poster"
                    src={group.movie.posterUrl || "/poster-placeholder.svg"}
                    alt={group.movie.title}
                  />
                </Link>
                <div>
                  <Link to={`/movies/${group.movie.slug}`}>
                    <h3>{group.movie.title}</h3>
                  </Link>
                  <Meta movie={group.movie} />
                  <div className="session-grid">
                    {group.sessions.map((s) => (
                      <div key={s.id}>
                        <small className="muted">{s.venue.name}</small>
                        <SessionButton
                          session={s}
                          movie={group.movie}
                          onBook={book}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <Empty
              title="No sessions match your filters"
              text="Try another date or reset your filters."
              action={
                <button
                  className="primary"
                  onClick={() => {
                    setSearch("");
                    setParams({ date: today() });
                  }}
                >
                  Reset filters
                </button>
              }
            />
          )}{" "}
          {!!resource.meta && resource.meta.lastPage > 1 && (
            <nav className="pagination" aria-label="Pagination">
              <button
                disabled={resource.meta.currentPage === 1 || resource.loading}
                onClick={() =>
                  update("page", String(resource.meta!.currentPage - 1))
                }
              >
                Previous
              </button>
              <span>
                Page {resource.meta.currentPage} of {resource.meta.lastPage}
              </span>
              <button
                disabled={
                  resource.meta.currentPage === resource.meta.lastPage ||
                  resource.loading
                }
                onClick={() =>
                  update("page", String(resource.meta!.currentPage + 1))
                }
              >
                Next
              </button>
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}
