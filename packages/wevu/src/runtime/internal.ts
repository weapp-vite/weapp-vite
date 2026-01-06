export function setComputedValue(
  setters: Record<string, (value: any) => void>,
  key: string,
  value: any,
) {
  const setter = setters[key]
  if (!setter) {
    throw new Error(`Computed property "${key}" is readonly`)
  }
  setter(value)
}

export function parseModelEventValue(event: any) {
  if (event == null) {
    return event
  }
  if (typeof event === 'object') {
    if ('detail' in event && event.detail && 'value' in event.detail) {
      return event.detail.value
    }
    if ('target' in event && event.target && 'value' in event.target) {
      return event.target.value
    }
  }
  return event
}
