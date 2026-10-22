import { useState } from 'react';

import { TextField } from '@/components/ui/text-field';
import { formatDate, parseDate, parseTime } from '@/lib/format';

type DateFieldProps = {
  label: string;
  /** Fecha 'AAAA-MM-DD' o null. */
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
};

/** Fecha escrita como DD/MM/AAAA (funciona igual en Android, iPhone y web). */
export function DateField({ label, value, onChange, error }: DateFieldProps) {
  const [text, setText] = useState(value ? formatDate(value) : '');

  function handleChange(next: string) {
    // Inserta las barras mientras se escribe: 05122026 → 05/12/2026.
    const digits = next.replace(/\D/g, '').slice(0, 8);
    const masked = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
      .filter(Boolean)
      .join('/');
    setText(masked);
    onChange(parseDate(masked));
  }

  return (
    <TextField
      label={label}
      value={text}
      onChangeText={handleChange}
      placeholder="DD/MM/AAAA"
      keyboardType="number-pad"
      maxLength={10}
      error={error ?? (text.length === 10 && !value ? 'Fecha inválida' : undefined)}
    />
  );
}

type TimeFieldProps = {
  label: string;
  /** Hora 'HH:MM' o null. */
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
};

export function TimeField({ label, value, onChange, error }: TimeFieldProps) {
  const [text, setText] = useState(value ?? '');

  function handleChange(next: string) {
    const digits = next.replace(/\D/g, '').slice(0, 4);
    const masked = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
    setText(masked);
    onChange(parseTime(masked));
  }

  return (
    <TextField
      label={label}
      value={text}
      onChangeText={handleChange}
      placeholder="HH:MM"
      keyboardType="number-pad"
      maxLength={5}
      error={error ?? (text.length === 5 && !value ? 'Hora inválida' : undefined)}
    />
  );
}
