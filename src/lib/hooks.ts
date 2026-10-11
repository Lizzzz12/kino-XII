import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
import type { Response } from "./types";
import { validateField, type Values } from "./validation";
export function useResource<T>(path: string | null) {
  const [result, setResult] = useState<Response<T> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setResult(null);
    setError(null);
    if (!path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api<T>(path, { signal: c.signal })
      .then((r) => {
        if (!c.signal.aborted) setResult(r);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [path, version]);
  return {
    data: result?.data,
    meta: result?.meta,
    error,
    loading,
    reload: useCallback(() => setVersion((v) => v + 1), []),
  };
}
export function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
export function useForm(initial: Values, required: string[]) {
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const errors: Record<string, string> = {};
  Object.keys(values).forEach(
    (k) => (errors[k] = serverErrors[k] || validateField(k, values[k], values)),
  );
  const valid = required.every((k) => !errors[k]);
  function change(name: string, value: string | File | null) {
    setValues((v) => ({ ...v, [name]: value }));
    setServerErrors((e) => ({ ...e, [name]: "" }));
  }
  function blur(name: string) {
    setTouched((t) => ({ ...t, [name]: true }));
  }
  function server(error: unknown) {
    if (error instanceof ApiError && error.body.errors) {
      setServerErrors(
        Object.fromEntries(
          Object.entries(error.body.errors).map(([k, v]) => [k, v.join(" ")]),
        ),
      );
      setTouched((t) => ({
        ...t,
        ...Object.fromEntries(
          Object.keys(error.body.errors || {}).map((k) => [k, true]),
        ),
      }));
    }
  }
  return {
    values,
    errors,
    touched,
    valid,
    change,
    blur,
    server,
    setValues,
    reset: (next: Values) => {
      setValues(next);
      setTouched({});
      setServerErrors({});
    },
    touchAll: () =>
      setTouched(Object.fromEntries(required.map((k) => [k, true]))),
  };
}
export function useMutation() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      return await action();
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run, setError };
}
