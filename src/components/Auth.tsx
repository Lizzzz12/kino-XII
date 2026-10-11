import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, post, formData, setReauthenticate, tokenStore } from "../lib/api";
import type { User } from "../lib/types";
import { useForm, useMutation } from "../lib/hooks";
import { AvatarInput, ErrorBox, Field, Modal } from "./UI";
interface AuthValue {
  user: User | null;
  booting: boolean;
  bootError: Error | null;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
  open: (mode?: "login" | "register") => void;
  logout: () => Promise<void>;
  ensure: (
    action: (user: User) => Promise<void> | void,
    complete?: boolean,
  ) => Promise<void>;
}
const AuthContext = createContext<AuthValue>(null!);
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(!!tokenStore.get());
  const [bootError, setBootError] = useState<Error | null>(null);
  const [mode, setMode] = useState<"login" | "register" | null>(null);
  const waiting = useRef<{ resolve: () => void; reject: (e: Error) => void }[]>(
    [],
  );
  const pending = useRef<(() => Promise<void> | void) | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const userRef = useRef(user);
  userRef.current = user;
  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setBooting(false);
      return;
    }
    setBooting(true);
    setBootError(null);
    try {
      setUser((await api<User>("/me")).data);
    } catch (e) {
      if ((e as { status?: number }).status === 401) {
        tokenStore.clear();
        setUser(null);
      } else setBootError(e as Error);
    } finally {
      setBooting(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    setReauthenticate(() => {
      tokenStore.clear();
      setUser(null);
      setMode("login");
      return new Promise((resolve, reject) =>
        waiting.current.push({ resolve, reject }),
      );
    });
  }, []);
  const close = useCallback(() => {
    setMode(null);
    waiting.current
      .splice(0)
      .forEach((w) =>
        w.reject(new Error("Sign in was cancelled. Please try again.")),
      );
    pending.current = null;
  }, []);
  async function ensure(
    action: (user: User) => Promise<void> | void,
    complete = true,
  ) {
    if (!userRef.current) {
      pending.current = () => ensure(action, complete);
      setMode("login");
      return;
    }
    if (complete && !userRef.current.profileComplete) {
      pending.current = () => action(userRef.current!);
      sessionStorage.setItem(
        "kino-return",
        location.pathname + location.search,
      );
      navigate("/profile");
      return;
    }
    await action(userRef.current);
  }
  async function authenticated(u: User, token: string) {
    tokenStore.set(token);
    userRef.current = u;
    setUser(u);
    setMode(null);
    waiting.current.splice(0).forEach((w) => w.resolve());
    const action = pending.current;
    pending.current = null;
    if (action) await action();
  }
  async function updateUser(u: User) {
    userRef.current = u;
    setUser(u);
    if (u.profileComplete && pending.current) {
      const action = pending.current;
      pending.current = null;
      const returnTo = sessionStorage.getItem("kino-return");
      sessionStorage.removeItem("kino-return");
      if (returnTo) navigate(returnTo);
      await action();
    }
  }
  async function logout() {
    await post("/logout");
    tokenStore.clear();
    setUser(null);
    pending.current = null;
    sessionStorage.removeItem("kino-booking");
    navigate("/");
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        booting,
        bootError,
        refresh,
        setUser: (u) => {
          void updateUser(u);
        },
        open: (m = "login") => setMode(m),
        logout,
        ensure,
      }}
    >
      {children}
      {mode && (
        <AuthModal
          key={mode}
          mode={mode}
          close={close}
          switchMode={() => setMode(mode === "login" ? "register" : "login")}
          authenticated={authenticated}
        />
      )}
    </AuthContext.Provider>
  );
}
function AuthModal({
  mode,
  close,
  switchMode,
  authenticated,
}: {
  mode: "login" | "register";
  close: () => void;
  switchMode: () => void;
  authenticated: (u: User, t: string) => Promise<void>;
}) {
  const register = mode === "register";
  const form = useForm(
    {
      email: "",
      password: "",
      username: "",
      password_confirmation: "",
      avatar: null,
    },
    register
      ? ["username", "email", "password", "password_confirmation", "avatar"]
      : ["email", "password"],
  );
  const mutation = useMutation();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    form.touchAll();
    if (!form.valid) return;
    try {
      await mutation.run(async () => {
        const result = await post<{ user: User; token: string }>(
          register ? "/register" : "/login",
          register
            ? formData(form.values)
            : { email: form.values.email, password: form.values.password },
        );
        await authenticated(result.data.user, result.data.token);
      });
    } catch (e) {
      form.server(e);
    }
  }
  return (
    <Modal title={register ? "Sign up" : "Log in"} onClose={close}>
      <p className="muted">Welcome {register ? "to" : "back to"} Kino XII</p>
      <form onSubmit={submit}>
        {register && (
          <>
            <AvatarInput form={form} />
            <Field
              form={form}
              name="username"
              label="Username"
              autoComplete="username"
            />
          </>
        )}
        <Field
          form={form}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
        />
        <div className={register ? "two-columns" : ""}>
          <Field
            form={form}
            name="password"
            label="Password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
          />
          {register && (
            <Field
              form={form}
              name="password_confirmation"
              label="Confirm password"
              type="password"
              autoComplete="new-password"
            />
          )}
        </div>
        <ErrorBox error={mutation.error} />
        <button
          className="primary full"
          disabled={!form.valid || mutation.busy}
        >
          {mutation.busy ? "Please wait…" : register ? "Sign up" : "Log in"}
        </button>
      </form>
      <p className="center muted">
        {register ? "Already have an account?" : "Don’t have an account?"}{" "}
        <button className="text-button" onClick={switchMode}>
          {register ? "Log in" : "Sign up"}
        </button>
      </p>
    </Modal>
  );
}
