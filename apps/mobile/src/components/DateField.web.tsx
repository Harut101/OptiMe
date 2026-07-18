import { Field } from './Field';

interface DateFieldProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}

// Native platforms use the system date picker. Web keeps an accessible ISO fallback.
export function DateField({ label, placeholder, value, onChange }: DateFieldProps) {
  return (
    <Field
      label={label}
      placeholder={placeholder}
      value={value}
      inputMode="numeric"
      onChangeText={onChange}
    />
  );
}
