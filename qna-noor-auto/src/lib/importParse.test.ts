import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyMoneyRow,
  parseAmount,
  parseFlexibleDate,
  parseFlexibleTime,
} from "./importParse";

test("parses the supported date formats", () => {
  assert.equal(parseFlexibleDate("2026-01-05"), "2026-01-05");
  assert.equal(parseFlexibleDate("2026/01/05"), "2026-01-05");
  assert.equal(parseFlexibleDate("1/5/2026"), "2026-01-05");
  assert.equal(parseFlexibleDate("1/5/26"), "2026-01-05");
  assert.equal(parseFlexibleDate("01-05-2026"), "2026-01-05");
  assert.equal(
    parseFlexibleDate("2026-01-05T17:30:00-05:00"),
    "2026-01-05",
  );
  assert.equal(parseFlexibleDate("Jan 5, 2026"), "2026-01-05");
  assert.equal(parseFlexibleDate("5 Jan 2026"), "2026-01-05");
});

test("uses US order for ambiguous slashes and rejects invalid calendar dates", () => {
  assert.equal(parseFlexibleDate("5/6/2026"), "2026-05-06");
  assert.equal(parseFlexibleDate("2/29/2024"), "2024-02-29");
  assert.equal(parseFlexibleDate("2/29/2025"), null);
  assert.equal(parseFlexibleDate("2026-02-30"), null);
  assert.equal(parseFlexibleDate("13/1/2026"), null);
  assert.equal(parseFlexibleDate(""), null);
});

test("parses 12-hour and 24-hour times", () => {
  assert.equal(parseFlexibleTime("9:00 PM"), "21:00");
  assert.equal(parseFlexibleTime("9pm"), "21:00");
  assert.equal(parseFlexibleTime("12:00 AM"), "00:00");
  assert.equal(parseFlexibleTime("21:00"), "21:00");
  assert.equal(parseFlexibleTime("21:00:00"), "21:00");
  assert.equal(parseFlexibleTime("24:00"), null);
  assert.equal(parseFlexibleTime("9:60 PM"), null);
});

test("parses currency, negative, and parenthesized amounts", () => {
  assert.equal(parseAmount("$1,234.56"), 1234.56);
  assert.equal(parseAmount("-12.00"), -12);
  assert.equal(parseAmount("(12.00)"), -12);
  assert.equal(parseAmount("($1,234.56)"), -1234.56);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("12.00 CR"), null);
  assert.equal(parseAmount("1,23.00"), null);
});

test("classifies debit and credit columns before type or signed amount", () => {
  assert.deepEqual(
    classifyMoneyRow({ amount: 500, debit: 12, credit: 30, type: "deposit" }),
    { kind: "expense", amount: 12 },
  );
  assert.deepEqual(
    classifyMoneyRow({ amount: -20, credit: 20 }),
    { kind: "income", amount: 20 },
  );
  assert.deepEqual(
    classifyMoneyRow({ debit: 0, credit: 45 }),
    { kind: "income", amount: 45 },
  );
  assert.deepEqual(
    classifyMoneyRow({ debit: 12, credit: 0 }),
    { kind: "expense", amount: 12 },
  );
  assert.equal(classifyMoneyRow({ debit: 0, credit: 0 }), null);
});

test("classifies type text before falling back to the amount sign", () => {
  assert.deepEqual(
    classifyMoneyRow({ amount: -8, type: "Deposit" }),
    { kind: "income", amount: 8 },
  );
  assert.deepEqual(
    classifyMoneyRow({ amount: 8, type: "Card payment" }),
    { kind: "expense", amount: 8 },
  );
  assert.deepEqual(
    classifyMoneyRow({ amount: -8 }),
    { kind: "expense", amount: 8 },
  );
  assert.deepEqual(
    classifyMoneyRow({ amount: 8 }),
    { kind: "income", amount: 8 },
  );
});

test("does not classify zero or missing amounts", () => {
  assert.equal(classifyMoneyRow({ amount: 0 }), null);
  assert.equal(classifyMoneyRow({ amount: null }), null);
  assert.deepEqual(
    classifyMoneyRow({ debit: 0, amount: 10 }),
    { kind: "income", amount: 10 },
  );
  assert.deepEqual(
    classifyMoneyRow({ debit: 0, credit: 0, amount: -10 }),
    { kind: "expense", amount: 10 },
  );
});
