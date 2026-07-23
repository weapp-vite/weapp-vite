export function readBooleanAttribute(element: Element, name: string) {
  const value = element.getAttribute(name)
  return value !== null && value !== 'false' && value !== '0'
}

export function resolveContainingShadowRoot(element: Element) {
  const root = element.getRootNode()
  return typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot ? root : undefined
}

export function dispatchMiniProgramEvent<T>(element: Element, name: string, detail: T) {
  element.dispatchEvent(new CustomEvent(name, {
    bubbles: true,
    composed: true,
    detail,
  }))
}
