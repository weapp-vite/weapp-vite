export interface FormControlContract extends HTMLElement {
  readonly formControlName: string
  readonly formControlValue: unknown
  readonly formControlDisabled: boolean
  formReset: () => void
  formActivate?: () => void
}

export interface FormOwnerContract extends HTMLElement {
  requestSubmit: () => void
  reset: () => void
}

const controlsByForm = new WeakMap<HTMLElement, Set<FormControlContract>>()
const formByControl = new WeakMap<FormControlContract, HTMLElement>()

function resolveParentAcrossShadow(element: Element): Element | null {
  if (element.parentElement) {
    return element.parentElement
  }
  const root = element.getRootNode()
  return typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot
    ? root.host
    : null
}

export function findClosestComposedElement(element: Element, selector: string) {
  let current: Element | null = element
  while (current) {
    if (current.matches(selector)) {
      return current as HTMLElement
    }
    current = resolveParentAcrossShadow(current)
  }
  return null
}

export function disconnectFormControl(control: FormControlContract) {
  const form = formByControl.get(control)
  if (!form) {
    return
  }
  controlsByForm.get(form)?.delete(control)
  formByControl.delete(control)
}

export function connectFormControl(control: FormControlContract) {
  disconnectFormControl(control)
  const form = findClosestComposedElement(control, 'weapp-form')
  if (!form) {
    return
  }
  let controls = controlsByForm.get(form)
  if (!controls) {
    controls = new Set()
    controlsByForm.set(form, controls)
  }
  controls.add(control)
  formByControl.set(control, form)
}

export function collectFormControlValues(form: HTMLElement) {
  const values: Record<string, unknown> = {}
  for (const control of controlsByForm.get(form) ?? []) {
    if (formByControl.get(control) !== form || control.formControlDisabled) {
      continue
    }
    const name = control.formControlName.trim()
    if (!name) {
      continue
    }
    values[name] = control.formControlValue
  }
  return values
}

export function resetFormControls(form: HTMLElement) {
  for (const control of controlsByForm.get(form) ?? []) {
    if (formByControl.get(control) === form) {
      control.formReset()
    }
  }
}

export function requestContainingFormAction(source: Element, action: 'submit' | 'reset') {
  const form = findClosestComposedElement(source, 'weapp-form') as FormOwnerContract | null
  if (!form) {
    return false
  }
  if (action === 'submit') {
    form.requestSubmit()
  }
  else {
    form.reset()
  }
  return true
}

export function isFormActivatable(value: Element): value is FormControlContract {
  return typeof (value as FormControlContract).formActivate === 'function'
}
