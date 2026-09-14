import Link from "next/link";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            {eyebrow}
          </p>
        )}
        <h1 className="break-words text-[22px] font-semibold tracking-tight text-zinc-900 sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">{description}</p>
        )}
      </div>
      {actions && (
        <div className="no-print flex flex-wrap items-center gap-2 sm:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-card
      className={cn(
        "rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export function CardHeader({
  title,
  description,
  actions,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const trailing = actions ?? children;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-zinc-500">{description}</p>
        )}
      </div>
      {trailing && (
        <div className="flex shrink-0 items-center gap-2">{trailing}</div>
      )}
    </div>
  );
}

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "dangerSolid";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "xs" | "sm" | "md";
  leading?: React.ReactNode;
};

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vx-accent-600)] focus-visible:ring-offset-1";

const btnVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)] hover:bg-[var(--vx-accent-700)]",
  secondary:
    "border border-zinc-300 bg-white text-zinc-800 shadow-sm hover:bg-zinc-50",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  danger:
    "border border-red-300 bg-white text-red-700 shadow-sm hover:bg-red-50",
  dangerSolid: "bg-red-600 text-white hover:bg-red-700",
};

const btnSizes = {
  xs: "h-7 px-2.5 text-xs",
  sm: "h-8 px-3 text-sm",
  md: "h-9 px-4 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  leading,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(btnBase, btnVariants[variant], btnSizes[size], className)}
      {...props}
    >
      {leading}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  leading,
  className,
  children,
  target,
  rel,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: "xs" | "sm" | "md";
  leading?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  target?: string;
  rel?: string;
}) {
  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      className={cn(btnBase, btnVariants[variant], btnSizes[size], className)}
    >
      {leading}
      {children}
    </Link>
  );
}

export function SegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      <div className="flex rounded-lg bg-zinc-100 p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={cn(
              "min-h-8 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              value === option.value
                ? "bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)] shadow-sm"
                : "text-zinc-600 hover:text-zinc-900",
            )}
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const controlClass =
  "block w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-none outline-none transition focus:border-[var(--vx-accent-600)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--vx-accent-600)_25%,transparent)]";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn("h-9", controlClass, props.className)}
    />
  );
}

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea(props, ref) {
  return (
    <textarea
      {...props}
      ref={ref}
      className={cn("py-2", controlClass, props.className)}
    />
  );
});

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  return (
    <select
      {...props}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 0.65rem center",
        backgroundRepeat: "no-repeat",
        ...props.style,
      }}
      className={cn("h-9 appearance-none pr-9", controlClass, props.className)}
    />
  );
}

export function Label({
  children,
  htmlFor,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-1.5 block text-xs font-medium text-zinc-600",
        className,
      )}
    >
      {children}
    </label>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "accent";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-zinc-100 text-zinc-700",
  info: "bg-blue-100 text-blue-800",
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  accent: "bg-[var(--vx-accent-100)] text-[var(--vx-accent-700)]",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
        badgeTones[tone],
        className,
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-current opacity-60"
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tones: Record<string, BadgeTone> = {
    ESTIMATE: "neutral",
    IN_PROGRESS: "warning",
    COMPLETED: "info",
    INVOICED: "accent",
    PAID: "success",
    CANCELLED: "danger",
  };
  return (
    <Badge tone={tones[status] ?? "neutral"}>
      {status.replace("_", " ")}
    </Badge>
  );
}

export function Table({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-sm", className)}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-zinc-50/60 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-zinc-100">{children}</tbody>;
}

export function TR({ children }: { children: React.ReactNode }) {
  return <tr className="transition-colors hover:bg-zinc-50/70">{children}</tr>;
}

export function TD({
  children,
  numeric = false,
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
}) {
  return (
    <td
      {...props}
      className={cn(
        "px-4 py-3 align-middle",
        numeric && "text-right tabular-nums",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-10 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-zinc-900">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  delta,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: {
    value: string;
    tone: "up" | "down" | "flat";
  };
  className?: string;
}) {
  const deltaClass = {
    up: "text-green-700",
    down: "text-red-700",
    flat: "text-zinc-500",
  };
  return (
    <div className={cn("rounded-xl border border-zinc-200 bg-white p-5", className)}>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-zinc-900">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
      {delta && (
        <p className={cn("mt-1 text-xs font-medium", deltaClass[delta.tone])}>
          {delta.value}
        </p>
      )}
    </div>
  );
}
