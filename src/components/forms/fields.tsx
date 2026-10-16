"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/format";

const inputBase =
  "mt-2 block w-full rounded-xl border bg-white px-4 py-3 text-[0.95rem] text-charcoal placeholder:text-ink-500/70 transition-colors focus:border-emerald focus:outline-none focus:ring-4 focus:ring-emerald/15";

type BaseProps = {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
};

function FieldShell({
  name,
  label,
  error,
  hint,
  required,
  className,
  children,
}: BaseProps & { children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="text-sm font-semibold text-forest">
        {label}
        {required ? (
          <span className="ml-0.5 text-alert" aria-hidden>
            *
          </span>
        ) : (
          <span className="ml-1.5 text-xs font-normal text-ink-500">(optional)</span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${name}-hint`} className="mt-1.5 text-xs text-ink-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-xs font-medium text-alert" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = (name: string, error?: string, hint?: string) =>
  error ? `${name}-error` : hint ? `${name}-hint` : undefined;

export function TextField({
  type = "text",
  autoComplete,
  placeholder,
  inputMode,
  ...props
}: BaseProps & {
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const { name, error, hint, required } = props;
  return (
    <FieldShell {...props}>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={describedBy(name, error, hint)}
        className={cn(inputBase, error ? "border-alert" : "border-forest/15")}
      />
    </FieldShell>
  );
}

export function TextArea({ rows = 4, placeholder, ...props }: BaseProps & { rows?: number; placeholder?: string }) {
  const { name, error, hint, required } = props;
  return (
    <FieldShell {...props}>
      <textarea
        id={name}
        name={name}
        rows={rows}
        placeholder={placeholder}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={describedBy(name, error, hint)}
        className={cn(inputBase, "resize-y", error ? "border-alert" : "border-forest/15")}
      />
    </FieldShell>
  );
}

export function SelectField({
  options,
  placeholder = "Please select",
  ...props
}: BaseProps & { options: ReadonlyArray<{ value: string; label: string }>; placeholder?: string }) {
  const { name, error, hint, required } = props;
  return (
    <FieldShell {...props}>
      <select
        id={name}
        name={name}
        defaultValue=""
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={describedBy(name, error, hint)}
        className={cn(inputBase, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23123B2A%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_1rem_center] bg-no-repeat pr-10", error ? "border-alert" : "border-forest/15")}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxGroup({
  name,
  legend,
  options,
  error,
  required,
  className,
}: {
  name: string;
  legend: string;
  options: readonly string[];
  error?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <fieldset className={className} aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="text-sm font-semibold text-forest">
        {legend}
        {required && (
          <span className="ml-0.5 text-alert" aria-hidden>
            *
          </span>
        )}
      </legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o}
            className="cursor-pointer rounded-full border border-forest/15 bg-white px-4 py-2 text-sm text-charcoal transition-colors has-[:checked]:border-emerald has-[:checked]:bg-emerald has-[:checked]:text-ivory has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-emerald/20"
          >
            <input type="checkbox" name={name} value={o} className="sr-only" />
            {o}
          </label>
        ))}
      </div>
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-xs font-medium text-alert" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function ConsentField({
  name,
  children,
  error,
}: {
  name: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink-600">
        <input
          type="checkbox"
          name={name}
          value="yes"
          aria-required
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
          className="mt-1 h-4.5 w-4.5 shrink-0 rounded border-forest/30 accent-emerald"
        />
        <span>{children}</span>
      </label>
      {error && (
        <p id={`${name}-error`} className="mt-1.5 pl-7 text-xs font-medium text-alert" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Hidden honeypot field to deter basic spam bots. */
export function Honeypot() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        Leave this field empty
        <input type="text" name="company_website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}
