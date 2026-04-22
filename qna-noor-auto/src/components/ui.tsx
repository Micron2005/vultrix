import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-zinc-200">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
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
      className={cn(
        "rounded-lg border border-zinc-200 bg-white shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

const btnBase =
  "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1";

const btnVariants = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-800",
  secondary:
    "bg-white text-zinc-900 border border-zinc-300 hover:bg-zinc-50",
  ghost: "text-zinc-700 hover:bg-zinc-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const btnSizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-9 px-4 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(btnBase, btnVariants[variant], btnSizes[size], className)}
      {...props}
    />
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  target,
  rel,
}: {
  href: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
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
      {children}
    </Link>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900",
        props.className,
      )}
    />
  );
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={cn(
        "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900",
        props.className,
      )}
    />
  );
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  return (
    <select
      {...props}
      className={cn(
        "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900",
        props.className,
      )}
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
        "block text-xs font-medium text-zinc-700 mb-1",
        className,
      )}
    >
      {children}
    </label>
  );
}

export function Field({
  label,
  children,
  htmlFor,
  className,
}: {
  label: string;
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ESTIMATE: "bg-zinc-100 text-zinc-700",
    IN_PROGRESS: "bg-amber-100 text-amber-800",
    COMPLETED: "bg-blue-100 text-blue-800",
    INVOICED: "bg-indigo-100 text-indigo-800",
    PAID: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };
  const cls = map[status] ?? "bg-zinc-100 text-zinc-700";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        cls,
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center">
      <h3 className="text-sm font-medium text-zinc-900">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
