import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent } from 'react';

type Props = {
  value: number | null;
  onChange: (v: number | null) => void;
  emptyValue?: number | null;
  min?: number;
  step?: number;
  'aria-label'?: string;
  id?: string;
  required?: boolean;
  className?: string;
};

const show = (v: number | null) => (v === null ? '' : String(v));

/**
 * A number input that can be emptied and re-typed: the text is kept while editing,
 * selected on focus, and committed on blur / Enter.
 */
export default function NumberField({ value, onChange, emptyValue = null, min, step, className, ...rest }: Props) {
  const [text, setText] = useState(show(value));
  const [focused, setFocused] = useState(false);
  // Browsers clear a focus-time select() on the mouseup of the same click; keep the selection.
  const justFocused = useRef(false);

  useEffect(() => {
    if (!focused) setText(show(value));
  }, [value, focused]);

  const parse = (t: string): number | null | 'invalid' => {
    if (t.trim() === '') return null;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : 'invalid';
  };

  function commit() {
    const parsed = parse(text);
    let next: number | null;
    if (parsed === 'invalid') next = value;
    else if (parsed === null) next = emptyValue;
    else next = min !== undefined && parsed < min ? min : parsed;
    setText(show(next));
    if (next !== value) onChange(next);
  }

  function change(t: string) {
    setText(t);
    const parsed = parse(t);
    if (typeof parsed === 'number' && (min === undefined || parsed >= min)) onChange(parsed);
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode={step !== undefined && step < 1 ? 'decimal' : 'numeric'}
      value={text}
      onFocus={(e: FocusEvent<HTMLInputElement>) => { setFocused(true); justFocused.current = true; e.currentTarget.select(); }}
      onMouseUp={(e: MouseEvent<HTMLInputElement>) => { if (justFocused.current) { e.preventDefault(); justFocused.current = false; } }}
      onChange={(e) => { justFocused.current = false; change(e.target.value); }}
      onBlur={() => { setFocused(false); justFocused.current = false; commit(); }}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
      className={className}
    />
  );
}
