export type CheckboxValue = boolean | number | string

export interface CheckboxGroupContext {
  disabled: () => boolean
  isChecked: (value: CheckboxValue) => boolean
  toggle: (value: CheckboxValue) => void
}

export const checkboxGroupKey = Symbol('varo-checkbox-group')
