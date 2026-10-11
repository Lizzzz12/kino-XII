import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { useForm } from "../lib/hooks";
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const items = panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]',
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panel.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === panel.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
      >
        <div className="modal-heading">
          <h2 id={id}>{title}</h2>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Field({
  form,
  name,
  label,
  type = "text",
  disabled = false,
  placeholder,
  autoComplete,
}: {
  form: ReturnType<typeof useForm>;
  name: string;
  label: string;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  const id = useId();
  const error = form.touched[name] ? form.errors[name] : "";
  const success = form.touched[name] && !form.errors[name];
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        disabled={disabled}
        placeholder={placeholder}
        value={
          typeof form.values[name] === "string"
            ? (form.values[name] as string)
            : ""
        }
        onChange={(e) => form.change(name, e.target.value)}
        onBlur={() => form.blur(name)}
        className={error ? "invalid" : success ? "valid" : ""}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <small id={`${id}-error`} className="field-error">
          {error}
        </small>
      )}
    </label>
  );
}
export function ErrorBox({
  error,
  retry,
}: {
  error: Error | string | null | undefined;
  retry?: () => void;
}) {
  return error ? (
    <div className="notice danger" role="alert">
      {typeof error === "string" ? error : error.message}
      {retry && <button onClick={retry}>Try again</button>}
    </div>
  ) : null;
}
export function Empty({
  title = "Nothing here yet",
  text,
  action,
}: {
  title?: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">✧</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Skeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="skeleton-grid" aria-label="Loading" role="status">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}
export function AvatarInput({
  form,
  current,
}: {
  form: ReturnType<typeof useForm>;
  current?: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const file = form.values.avatar;
  useEffect(() => {
    if (file instanceof File) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(null);
  }, [file]);
  return (
    <div className="avatar-upload">
      <label>
        <span className="avatar">
          {preview ? (
            <img src={preview} alt="Selected avatar" />
          ) : current ? (
            <img src={current} alt="Current avatar" />
          ) : (
            "↑"
          )}
        </span>
        <span>
          Upload avatar (optional)<small>JPG, PNG, WebP · max 2 MB</small>
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            form.change("avatar", e.target.files?.[0] || null);
            form.blur("avatar");
          }}
        />
      </label>
      {form.errors.avatar && (
        <small className="field-error">{form.errors.avatar}</small>
      )}
    </div>
  );
}
