"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type GoalChartKind = "line" | "bar" | "pie";

export type GoalChartPoint = {
  day: string;
  value: number;
};

export type GoalChartSlice = {
  label: string;
  value: number;
};

export type GoalValueDescriptor = {
  money: boolean;
  unit: string | null;
};

type GoalChartProps = {
  kind: GoalChartKind;
  points: GoalChartPoint[];
  cumulative: GoalChartPoint[];
  pace: GoalChartPoint[];
  slices: GoalChartSlice[];
  valueLabel: GoalValueDescriptor;
  emptyMessage: string;
};

function formatValue(value: number, descriptor: GoalValueDescriptor): string {
  if (descriptor.money) {
    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  const formatted = value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (!descriptor.unit) return formatted;
  if (descriptor.unit === "%") return `${formatted}%`;
  return `${formatted} ${descriptor.unit}`;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function shortDay(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function GoalTooltip({
  active,
  payload,
  label,
  descriptor,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string | number;
  descriptor: GoalValueDescriptor;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <p className="font-medium text-zinc-900 dark:text-zinc-100">
        {typeof label === "string" ? shortDay(label) : label}
      </p>
      {payload.map((entry) => (
        <p key={entry.name} className="mt-1 text-zinc-600 dark:text-zinc-300">
          <span style={{ color: entry.color }}>{entry.name}: </span>
          {formatValue(Number(entry.value ?? 0), descriptor)}
        </p>
      ))}
    </div>
  );
}

const palette = [
  "var(--color-blue-500)",
  "var(--color-violet-500)",
  "var(--color-emerald-500)",
  "var(--color-amber-500)",
  "var(--color-rose-500)",
  "var(--color-cyan-500)",
];

function axisProps(length: number) {
  return {
    interval: length > 20 ? Math.ceil(length / 8) - 1 : 0,
    tick: { fill: "var(--color-zinc-500)", fontSize: 11 },
  };
}

export function GoalChart({
  kind,
  points,
  cumulative,
  pace,
  slices,
  valueLabel,
  emptyMessage,
}: GoalChartProps) {
  const data = kind === "line" ? cumulative : points;
  const hasChartData =
    kind === "pie"
      ? slices.some((slice) => slice.value !== 0)
      : data.some((point) => point.value !== 0);
  if (!hasChartData) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
        {emptyMessage}
      </div>
    );
  }
  if (kind === "pie") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart margin={{ top: 24, right: 32, bottom: 8, left: 32 }}>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="45%"
            innerRadius={52}
            outerRadius={78}
            labelLine={{ stroke: "var(--color-zinc-300)" }}
            label={({ name, percent }) =>
              `${truncate(String(name ?? ""), 14)} ${Math.round(Number(percent ?? 0) * 100)}%`
            }
          >
            {slices.map((slice, index) => (
              <Cell key={slice.label} fill={palette[index % palette.length]} />
            ))}
          </Pie>
          <Tooltip
            content={
              <GoalTooltip descriptor={valueLabel} />
            }
          />
          <Legend verticalAlign="bottom" height={24} />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  const common = {
    data,
    margin: { top: 10, right: 12, left: 0, bottom: 8 },
  };
  const axes = (
    <>
      <CartesianGrid stroke="var(--color-zinc-300)" strokeDasharray="3 3" />
      <XAxis
        dataKey="day"
        axisLine={{ stroke: "var(--color-zinc-300)" }}
        tickLine={{ stroke: "var(--color-zinc-300)" }}
        tickFormatter={(value: string) => truncate(shortDay(value), 14)}
        {...axisProps(data.length)}
      />
      <YAxis
        axisLine={{ stroke: "var(--color-zinc-300)" }}
        tickLine={{ stroke: "var(--color-zinc-300)" }}
        tickFormatter={(value) => formatValue(Number(value), valueLabel)}
        tick={{ fill: "var(--color-zinc-500)", fontSize: 11 }}
        width={72}
      />
      <Tooltip content={<GoalTooltip descriptor={valueLabel} />} />
    </>
  );
  if (kind === "bar") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart {...common}>
          {axes}
          <Bar dataKey="value" name="Progress" fill="var(--color-blue-500)" />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  const lineData = cumulative.map((point, index) => ({
    ...point,
    pace: pace[index]?.value,
  }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={lineData} margin={common.margin}>
        {axes}
        <Line
          type="monotone"
          dataKey="value"
          name="Progress"
          stroke="var(--color-blue-500)"
          strokeWidth={2.5}
          dot={false}
        />
        {pace.length > 0 && (
          <Line
            type="monotone"
            dataKey="pace"
            name="Where you should be"
            stroke="var(--color-zinc-400)"
            strokeDasharray="4 4"
            dot={false}
          />
        )}
        <Legend />
      </LineChart>
    </ResponsiveContainer>
  );
}
