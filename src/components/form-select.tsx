"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FormSelectOption = {
  value: string;
  label: string;
  group?: string;
};

type FormSelectProps = {
  name: string;
  options: FormSelectOption[];
  placeholder: string;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
  id?: string;
};

/**
 * Select de shadcn utilizable dentro de un formulario de server action:
 * Base UI publica el valor en un input oculto con este `name`.
 */
export function FormSelect({
  name,
  options,
  placeholder,
  defaultValue = "",
  disabled,
  required,
  className,
  id,
  ...props
}: FormSelectProps) {
  const groups = options.reduce<Map<string, FormSelectOption[]>>((acc, option) => {
    const key = option.group ?? "";
    acc.set(key, [...(acc.get(key) ?? []), option]);
    return acc;
  }, new Map());

  return (
    <Select name={name} defaultValue={defaultValue} disabled={disabled} required={required}>
      <SelectTrigger
        id={id}
        aria-label={props["aria-label"]}
        className={className ?? "h-12 w-full rounded-xl px-4 text-base font-semibold"}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {Array.from(groups.entries()).map(([group, items]) => (
          <SelectGroup key={group}>
            {group ? <SelectLabel>{group}</SelectLabel> : null}
            {items.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
