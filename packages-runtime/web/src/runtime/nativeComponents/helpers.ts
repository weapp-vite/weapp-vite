export function readBooleanAttribute(element: Element, name: string) {
  const value = element.getAttribute(name)
  return value !== null && value !== 'false' && value !== '0'
}

export function resolveMaxLength(value: string | null) {
  if (value === null) {
    return undefined
  }
  const maxlength = Number(value)
  return Number.isInteger(maxlength) && maxlength >= 0 ? maxlength : undefined
}

export function resolveContainingShadowRoot(element: Element) {
  const root = element.getRootNode()
  return typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot ? root : undefined
}

export function dispatchMiniProgramEvent<T>(
  element: Element,
  name: string,
  detail: T,
  options: Pick<CustomEventInit<T>, 'bubbles' | 'composed'> = {},
) {
  element.dispatchEvent(new CustomEvent(name, {
    bubbles: options.bubbles ?? true,
    composed: options.composed ?? true,
    detail,
  }))
}
