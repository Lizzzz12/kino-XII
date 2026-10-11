import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./components/Auth";
import { Header } from "./components/Header";
import { Booking } from "./components/Booking";
import { Empty, ErrorBox } from "./components/UI";
import { useResource } from "./lib/hooks";
import type { Options } from "./lib/types";
import { Home } from "./pages/Home";
import { Sessions } from "./pages/Sessions";
import { MovieDetail } from "./pages/MovieDetail";
import { Profile } from "./pages/Profile";

const Context = createContext<{
  options: Options | undefined;
  book: (id: number) => void;
}>(null!);
export const useApp = () => useContext(Context);
function Shell() {
  const auth = useAuth();
  const options = useResource<Options>("/filter-options");
  const [booking, setBooking] = useState<number | null>(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("kino-booking") || "null",
      );
      return saved?.sessionId || null;
    } catch {
      return null;
    }
  });
  const closeBooking = useCallback(() => setBooking(null), []);
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <Context.Provider value={{ options: options.data, book: setBooking }}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Header />
      {auth.bootError && (
        <div className="container">
          <ErrorBox error={auth.bootError} retry={() => void auth.refresh()} />
        </div>
      )}
      {options.error && (
        <div className="container">
          <ErrorBox error={options.error} retry={options.reload} />
        </div>
      )}
      <div id="main-content" key={location.pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/movies/:slug" element={<MovieDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/tickets" element={<Profile tickets />} />
          <Route
            path="*"
            element={
              <main className="container">
                <Empty
                  title="Page not found"
                  text="Let’s get you back to the movies."
                  action={
                    <Link className="primary" to="/">
                      Go home
                    </Link>
                  }
                />
              </main>
            }
          />
        </Routes>
      </div>
      <footer className="container">
        <Link className="logo" to="/">
          KINO <span>XII</span>
        </Link>
        <small>
          © {new Date().getFullYear()} Kino XII · Your next great story starts
          here.
        </small>
      </footer>
      {booking !== null && (
        <Booking key={booking} sessionId={booking} onClose={closeBooking} />
      )}
    </Context.Provider>
  );
}
export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
