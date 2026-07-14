import { useEffect, useState, type ReactNode } from 'react';

export function HelpTip({ text }: { text: string }) {
  return (
    <span className="helptip" tabIndex={0} aria-label={text}>
      ?<span className="helptip-body">{text}</span>
    </span>
  );
}

export function Field({
  label,
  help,
  unit,
  children,
}: {
  label: string;
  help?: string;
  unit?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {help ? <HelpTip text={help} /> : null}
      </span>
      <span className="field-control">
        {children}
        {unit ? <span className="field-unit">{unit}</span> : null}
      </span>
    </label>
  );
}

/** Numeric input that tolerates in-progress typing and commits parsed values. */
export function NumberInput({
  value,
  onChange,
  step,
  min,
  placeholder,
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    setText(value == null ? '' : String(value));
  }, [value]);
  return (
    <input
      type="number"
      inputMode="decimal"
      value={text}
      step={step}
      min={min}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => {
        setText(e.target.value);
        const v = e.target.value === '' ? null : Number(e.target.value);
        if (v === null || !Number.isNaN(v)) onChange(v);
      }}
    />
  );
}

/** Percent input: displays 6.5 for value 0.065 */
export function PctInput({
  value,
  onChange,
  dp = 2,
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  dp?: number;
  disabled?: boolean;
}) {
  const shown = value == null ? null : Number((value * 100).toFixed(dp + 4));
  return (
    <NumberInput
      value={shown}
      step={Math.pow(10, -dp) * 10}
      disabled={disabled}
      onChange={(v) => onChange(v == null ? null : v / 100)}
    />
  );
}

export function DateInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="date"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function SelectInput<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: readonly T[] | readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const opts = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : (o as { value: T; label: string }),
  );
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
