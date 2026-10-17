"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CircleCheck, LoaderCircle, TriangleAlert, X } from "lucide-react";
import type { ActionState } from "@/lib/erp/action";
import { cn } from "@/lib/format";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

const ErrorsCtx = createContext<Record<string, string>>({});
const PendingCtx = createContext(false);

/**
 * Form bound to a server action. Shows a pending state, inline field errors,
 * and a success / failure message. Never shows success unless the server
 * action actually returned ok.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  successMessage = true,
  onSuccess,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  successMessage?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    } else if (state.errors) {
      const first = Object.keys(state.errors)[0];
      ref.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.seq]);

  return (
    // Submitting through onSubmit (not the `action` prop) keeps the user's input
    // when validation fails — React 19 resets forms that use `action`.
    <form
      ref={ref}
      noValidate
      aria-busy={pending}
      className={cn("space-y-4", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return; // prevent double submission
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <PendingCtx.Provider value={pending}>
        <ErrorsCtx.Provider value={state.errors ?? {}}>{children}</ErrorsCtx.Provider>
      </PendingCtx.Provider>
      {state.message && (state.ok ? successMessage : true) && (
        <p
          role={state.ok ? "status" : "alert"}
          className={cn(
            "flex items-start gap-2 rounded-lg px-3 py-2 text-sm [overflow-wrap:anywhere] whitespace-pre-line",
            state.ok ? "bg-emerald-50 text-emerald" : "bg-alert-50 text-alert",
          )}
        >
          {state.ok ? <CircleCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />}
          {state.message}
        </p>
      )}
    </form>
  );
}

const inputCls =
  "mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-charcoal placeholder:text-ink-500/60 focus:border-emerald focus:outline-none focus:ring-4 focus:ring-emerald/15 disabled:bg-ivory";

function useField(name: string) {
  const errors = useContext(ErrorsCtx);
  const id = useId();
  const error = errors[name];
  return { id, error, cls: cn(inputCls, error ? "border-alert" : "border-forest/15") };
}

function Wrap({ id, label, hint, error, required, children, className }: {
  id: string; label: string; hint?: ReactNode; error?: string; required?: boolean; children: ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-xs font-semibold text-forest">
        {label}
        {required && <span className="text-alert" aria-hidden> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-e`} className="mt-1 text-xs font-medium text-alert">{error}</p>
      ) : hint ? (
        <p id={`${id}-h`} className="mt-1 text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = {
  name: string;
  label: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  type?: string;
  inputMode?: "numeric" | "decimal" | "tel" | "email" | "text";
  step?: string;
  min?: string;
  max?: string;
  autoComplete?: string;
};

export function Input({ name, label, hint, required, className, defaultValue, ...rest }: InputProps) {
  const f = useField(name);
  return (
    <Wrap id={f.id} label={label} hint={hint} error={f.error} required={required} className={className}>
      <input
        id={f.id}
        name={name}
        defaultValue={defaultValue ?? undefined}
        aria-invalid={!!f.error}
        aria-required={required}
        aria-describedby={f.error ? `${f.id}-e` : hint ? `${f.id}-h` : undefined}
        className={f.cls}
        {...rest}
      />
    </Wrap>
  );
}

export function MoneyInput(props: Omit<InputProps, "type" | "inputMode">) {
  return <Input {...props} inputMode="decimal" placeholder={props.placeholder ?? "0"} hint={props.hint ?? "PKR"} />;
}

export function Textarea({ name, label, hint, required, className, defaultValue, rows = 3, placeholder }: {
  name: string; label: string; hint?: ReactNode; required?: boolean; className?: string; defaultValue?: string | null; rows?: number; placeholder?: string;
}) {
  const f = useField(name);
  return (
    <Wrap id={f.id} label={label} hint={hint} error={f.error} required={required} className={className}>
      <textarea id={f.id} name={name} rows={rows} defaultValue={defaultValue ?? undefined} placeholder={placeholder}
        aria-invalid={!!f.error} aria-required={required} className={cn(f.cls, "resize-y")} />
    </Wrap>
  );
}

export function Select({ name, label, hint, required, className, defaultValue, options, placeholder = "Select…" }: {
  name: string; label: string; hint?: ReactNode; required?: boolean; className?: string; defaultValue?: string | null;
  options: ReadonlyArray<readonly [string, string]>; placeholder?: string | false;
}) {
  const f = useField(name);
  return (
    <Wrap id={f.id} label={label} hint={hint} error={f.error} required={required} className={className}>
      <select id={f.id} name={name} defaultValue={defaultValue ?? ""} aria-invalid={!!f.error} aria-required={required} className={f.cls}>
        {placeholder !== false && <option value="">{placeholder}</option>}
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </Wrap>
  );
}

export function Checkbox({ name, label, defaultChecked, hint }: { name: string; label: ReactNode; defaultChecked?: boolean; hint?: ReactNode }) {
  const f = useField(name);
  return (
    <div>
      <label className="flex items-start gap-2.5 text-sm text-charcoal">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 accent-emerald" />
        <span>{label}{hint && <span className="block text-xs text-ink-500">{hint}</span>}</span>
      </label>
      {f.error && <p className="mt-1 text-xs font-medium text-alert">{f.error}</p>}
    </div>
  );
}

export function FileField({ name, label, hint, accept = "image/*,application/pdf", capture }: {
  name: string; label: string; hint?: ReactNode; accept?: string; capture?: "environment" | "user";
}) {
  const f = useField(name);
  return (
    <Wrap id={f.id} label={label} hint={hint ?? "Optional · JPG, PNG, PDF"} error={f.error}>
      <input id={f.id} name={name} type="file" accept={accept} capture={capture}
        className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ivory" />
    </Wrap>
  );
}

/** Shows the server error for a field that has no visible input of its own. */
export function FieldError({ name }: { name: string }) {
  const errors = useContext(ErrorsCtx);
  return errors[name] ? <p role="alert" className="mt-2 text-xs font-medium text-alert">{errors[name]}</p> : null;
}

export function Hidden({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}

export function Submit({ children, variant = "primary", className, pendingLabel = "Saving…" }: {
  children: ReactNode; variant?: "primary" | "secondary" | "danger"; className?: string; pendingLabel?: string;
}) {
  const pending = useContext(PendingCtx);
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-70",
        variant === "primary" && "bg-forest text-ivory hover:bg-forest-700",
        variant === "secondary" && "border border-forest/15 bg-white text-forest hover:border-forest/40",
        variant === "danger" && "bg-alert text-white hover:bg-[#7f2f1e]",
        className,
      )}
    >
      {pending && <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />}
      {pending ? pendingLabel : children}
    </button>
  );
}

/**
 * Button that opens a confirmation dialog containing its own action form.
 * Used for approvals, reversals, voids and other important actions.
 */
export function ConfirmAction({
  action,
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "primary",
  children,
  triggerVariant = "secondary",
  keepOpen = false,
}: {
  action: Action;
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  variant?: "primary" | "danger";
  children?: ReactNode;
  triggerVariant?: "primary" | "secondary" | "danger" | "ghost";
  /** keep the dialog open after success (e.g. to show a one-time password) */
  keepOpen?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [key, setKey] = useState(0);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setKey((k) => k + 1);
          ref.current?.showModal();
        }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
          triggerVariant === "primary" && "bg-forest text-ivory hover:bg-forest-700",
          triggerVariant === "secondary" && "border border-forest/15 bg-white text-forest hover:border-forest/40",
          triggerVariant === "danger" && "border border-alert/30 bg-white text-alert hover:bg-alert-50",
          triggerVariant === "ghost" && "text-emerald hover:bg-emerald-50",
        )}
      >
        {trigger}
      </button>
      <dialog
        ref={ref}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-forest/10 p-0 shadow-2xl backdrop:bg-forest-950/50"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-base font-semibold text-forest">{title}</h2>
            <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className="rounded-md p-1 text-ink-500 hover:bg-ivory">
              <X className="h-4 w-4" />
            </button>
          </div>
          {description && <div className="mt-1.5 text-sm text-ink-600">{description}</div>}
          <ActionForm key={key} action={action} className="mt-4" onSuccess={keepOpen ? undefined : () => setTimeout(() => ref.current?.close(), 600)}>
            {children}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => ref.current?.close()} className="rounded-lg px-4 py-2 text-sm font-semibold text-ink-600 hover:bg-ivory">
                Cancel
              </button>
              <Submit variant={variant === "danger" ? "danger" : "primary"}>{confirmLabel}</Submit>
            </div>
          </ActionForm>
        </div>
      </dialog>
    </>
  );
}
