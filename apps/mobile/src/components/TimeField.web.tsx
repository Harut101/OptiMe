import { Field } from './Field';

interface TimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

// Native platforms use the system time picker. Web keeps an accessible HH:MM fallback.
export function TimeField({ label, value, onChange }: TimeFieldProps) {
  return <Field label={label} placeholder="07:30" value={value} inputMode="numeric" onChangeText={onChange} />;
}
