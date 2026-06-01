"use client";

import { useState } from "react";
import { Input } from "@/components/ui";
import { formatMileage, parseMileage } from "@/lib/utils";

/**
 * Mileage text field that lets the user type with thousands separators
 * (e.g. "123,456"). Digits are re-grouped with commas as they type, and the
 * submitted value is comma-formatted — server actions parse it via
 * `parseMileage`, which strips the commas. Self-contained/uncontrolled: pass
 * a numeric or string `defaultValue`.
 */
export function MileageInput({
  name,
  defaultValue,
  placeholder,
  className,
  id,
}: {
  name: string;
  defaultValue?: number | string | null;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const initial = formatMileage(parseMileage(defaultValue?.toString() ?? null));
  const [value, setValue] = useState(initial);

  return (
    <Input
      id={id}
      name={name}
      value={value}
      inputMode="numeric"
      placeholder={placeholder}
      className={className}
      onChange={(e) => {
        const parsed = parseMileage(e.target.value);
        setValue(parsed === null ? "" : formatMileage(parsed));
      }}
    />
  );
}
