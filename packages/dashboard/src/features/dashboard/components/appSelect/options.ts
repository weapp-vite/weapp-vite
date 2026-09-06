export interface AppSelectOption<TValue extends string> {
  disabled?: boolean
  label: string
  value: TValue
}

export function resolveAppSelectActiveValue<TValue extends string>(
  options: readonly AppSelectOption<TValue>[],
  activeValue: TValue | null,
  selectedValue: TValue,
) {
  let firstEnabled: TValue | null = null
  let selectedEnabled: TValue | null = null
  for (const option of options) {
    if (option.disabled) {
      continue
    }
    firstEnabled ??= option.value
    if (option.value === activeValue) {
      return option.value
    }
    if (option.value === selectedValue) {
      selectedEnabled = option.value
    }
  }
  return selectedEnabled ?? firstEnabled
}
