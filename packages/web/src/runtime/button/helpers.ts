const DEFAULT_HOVER_CLASS = 'button-hover'

export const DEFAULT_HOVER_START = 20
export const DEFAULT_HOVER_STAY = 70

export function toBoolean(value: string | null) {
  if (value === null) {
    return false
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === '' || normalized === 'true') {
    return true
  }
  return normalized !== 'false' && normalized !== '0'
}

export function parseNumber(value: string | null, fallback: number) {
  if (value === null || value === '') {
    return fallback
  }
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export function isDisabled(element: HTMLElement) {
  return toBoolean(element.getAttribute('disabled')) || toBoolean(element.getAttribute('loading'))
}

export function normalizeType(value: string | null) {
  if (!value) {
    return 'default'
  }
  const normalized = value.toLowerCase()
  if (normalized === 'primary' || normalized === 'warn') {
    return normalized
  }
  return 'default'
}

export function getHoverClass(element: HTMLElement) {
  const hoverClass = element.getAttribute('hover-class')
  if (!hoverClass) {
    return DEFAULT_HOVER_CLASS
  }
  if (hoverClass === 'none') {
    return ''
  }
  return hoverClass
}

export function isInternalNode(node: Node) {
  return node instanceof HTMLElement && node.dataset?.weappInternal === 'true'
}

export function collectFormValues(form: HTMLFormElement) {
  const values: Record<string, any> = {}

  const appendValue = (name: string, value: any, multiple = false) => {
    if (multiple) {
      if (!Array.isArray(values[name])) {
        values[name] = values[name] === undefined ? [] : [values[name]]
      }
      values[name].push(value)
      return
    }
    values[name] = value
  }

  const formElements = Array.from(form.elements ?? [])
  for (const element of formElements) {
    if (!(element instanceof HTMLElement)) {
      continue
    }
    const name = element.getAttribute('name')?.trim()
    if (!name) {
      continue
    }
    const disabled = 'disabled' in element ? (element as any).disabled : toBoolean(element.getAttribute('disabled'))
    if (disabled) {
      continue
    }
    if (element instanceof HTMLInputElement) {
      const type = element.type?.toLowerCase()
      if (type === 'checkbox') {
        if (element.checked) {
          appendValue(name, element.value, true)
        }
        continue
      }
      if (type === 'radio') {
        if (element.checked) {
          appendValue(name, element.value)
        }
        continue
      }
      appendValue(name, element.value)
      continue
    }
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      appendValue(name, (element as HTMLTextAreaElement | HTMLSelectElement).value)
      continue
    }
  }

  const customControls = form.querySelectorAll('switch, checkbox, radio, picker, slider, weapp-switch, weapp-checkbox, weapp-radio, weapp-picker, weapp-slider')
  for (const element of Array.from(customControls)) {
    const name = element.getAttribute('name')?.trim()
    if (!name) {
      continue
    }
    const disabled = toBoolean(element.getAttribute('disabled'))
    if (disabled) {
      continue
    }
    const tag = element.tagName.toLowerCase()
    const rawValue = (element as any).value ?? element.getAttribute('value')
    if (tag.includes('checkbox')) {
      const checked = (element as any).checked ?? toBoolean(element.getAttribute('checked'))
      if (checked) {
        appendValue(name, rawValue ?? true, true)
      }
      continue
    }
    if (tag.includes('radio')) {
      const checked = (element as any).checked ?? toBoolean(element.getAttribute('checked'))
      if (checked) {
        appendValue(name, rawValue ?? true)
      }
      continue
    }
    if (tag.includes('switch')) {
      const checked = (element as any).checked ?? toBoolean(element.getAttribute('checked'))
      appendValue(name, checked)
      continue
    }
    appendValue(name, rawValue ?? '')
  }

  return values
}
