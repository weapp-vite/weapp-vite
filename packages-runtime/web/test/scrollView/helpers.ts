export type ScrollViewElement = HTMLElement & {
  scrollLeft: number
  scrollTop: number
}

export function createScrollView(attributes: Record<string, string> = {}) {
  const element = document.createElement('weapp-scroll-view') as ScrollViewElement
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value)
  }
  document.body.append(element)
  return element
}

export function getViewport(element: HTMLElement) {
  return element.shadowRoot!.querySelector('.viewport') as HTMLDivElement
}

export function setMetrics(
  viewport: HTMLDivElement,
  metrics: { scrollHeight?: number, clientHeight?: number, scrollWidth?: number, clientWidth?: number },
) {
  Object.defineProperties(viewport, Object.fromEntries(
    Object.entries(metrics).map(([name, value]) => [name, { configurable: true, value }]),
  ))
}

export function scrollTo(element: ScrollViewElement, position: { top?: number, left?: number }) {
  const viewport = getViewport(element)
  if (position.top !== undefined) {
    element.scrollTop = position.top
  }
  if (position.left !== undefined) {
    element.scrollLeft = position.left
  }
  viewport.dispatchEvent(new Event('scroll'))
}
