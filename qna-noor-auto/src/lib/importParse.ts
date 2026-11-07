export type MoneyRowKind = "income" | "expense";

function dateKey(year: number, month: number, day: number): string | null {
  if (
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1
  ) {
    return null;
  }

  const leapYear =
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];
  if (day > daysInMonth) return null;

  return `${String(year).padStart(4, "0")}-${String(month).padStart(
    2,
    "0",
  )}-${String(day).padStart(2, "0")}`;
}

const MONTHS = new Map<string, number>([
  ["jan", 1],
  ["january", 1],
  ["feb", 2],
  ["february", 2],
  ["mar", 3],
  ["march", 3],
  ["apr", 4],
  ["april", 4],
  ["may", 5],
  ["jun", 6],
  ["june", 6],
  ["jul", 7],
  ["july", 7],
  ["aug", 8],
  ["august", 8],
  ["sep", 9],
  ["sept", 9],
  ["september", 9],
  ["oct", 10],
  ["october", 10],
  ["nov", 11],
  ["november", 11],
  ["dec", 12],
  ["december", 12],
]);

export function parseFlexibleDate(raw: string): string | null {
  const value = raw.trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return dateKey(Number(match[1]), Number(match[2]), Number(match[3]));

  match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(value);
  if (match) return dateKey(Number(match[1]), Number(match[2]), Number(match[3]));

  match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(value);
  if (match) {
    const yearText = match[3];
    const year = Number(yearText) + (yearText.length === 2 ? 2000 : 0);
    return dateKey(year, Number(match[1]), Number(match[2]));
  }

  match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (match) return dateKey(Number(match[3]), Number(match[1]), Number(match[2]));

  match = /^(\d{4}-\d{2}-\d{2})T.+$/i.exec(value);
  if (match && Number.isFinite(Date.parse(value))) {
    const [year, month, day] = match[1].split("-").map(Number);
    return dateKey(year, month, day);
  }

  match = /^([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/i.exec(value);
  if (match) {
    const month = MONTHS.get(match[1].toLowerCase());
    return month
      ? dateKey(Number(match[3]), month, Number(match[2]))
      : null;
  }

  match = /^(\d{1,2})\s+([a-z]{3,9})\s+(\d{4})$/i.exec(value);
  if (match) {
    const month = MONTHS.get(match[2].toLowerCase());
    return month
      ? dateKey(Number(match[3]), month, Number(match[1]))
      : null;
  }

  return null;
}

export function parseFlexibleTime(raw: string): string | null {
  const value = raw.trim();
  let match = /^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m?\.?$/i.exec(value);
  if (match) {
    let hour = Number(match[1]);
    const minute = Number(match[2] ?? "0");
    if (hour < 1 || hour > 12 || minute > 59) return null;
    const meridiem = match[3].toLowerCase();
    if (meridiem === "a" && hour === 12) hour = 0;
    if (meridiem === "p" && hour !== 12) hour += 12;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(
      2,
      "0",
    )}`;
  }

  match = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  if (hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

export function parseAmount(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;

  const parenthesized = value.startsWith("(") && value.endsWith(")");
  let amountText = parenthesized ? value.slice(1, -1).trim() : value;
  if (parenthesized && /^[+-]/.test(amountText)) return null;

  amountText = amountText.replace(/^\$/, "");
  const amountPattern =
    /^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/;
  if (!amountPattern.test(amountText)) return null;

  const amount = Number(amountText.replace(/,/g, ""));
  if (!Number.isFinite(amount)) return null;
  return parenthesized ? -Math.abs(amount) : amount;
}

export function classifyMoneyRow(input: {
  amount?: number | null;
  debit?: number | null;
  credit?: number | null;
  type?: string | null;
}): { kind: MoneyRowKind; amount: number } | null {
  const debit = Number(input.debit);
  if (input.debit != null && Number.isFinite(debit) && debit !== 0) {
    return { kind: "expense", amount: Math.abs(debit) };
  }

  const credit = Number(input.credit);
  if (input.credit != null && Number.isFinite(credit) && credit !== 0) {
    return { kind: "income", amount: Math.abs(credit) };
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount === 0) return null;

  const type = input.type?.trim() ?? "";
  if (/income|credit|deposit/i.test(type)) {
    return { kind: "income", amount: Math.abs(amount) };
  }
  if (/expense|debit|withdraw|payment/i.test(type)) {
    return { kind: "expense", amount: Math.abs(amount) };
  }
  return {
    kind: amount < 0 ? "expense" : "income",
    amount: Math.abs(amount),
  };
}
