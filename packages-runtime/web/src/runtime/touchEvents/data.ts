export interface RuntimeTouchPoint {
  identifier: number
  pageX: number
  pageY: number
  clientX: number
  clientY: number
  force?: number
}

interface RuntimeTouchData {
  source: Event
  canvas?: Element
  surface?: Element
  legacyCanvas?: boolean
}

const touchNames = new Set(['touchstart', 'touchmove', 'touchend', 'touchcancel'])
const touchData = new WeakMap<Event, RuntimeTouchData>()

export function isRuntimeTouchName(name: string) {
  return touchNames.has(name)
}

export function isRuntimeTouchEvent(event: Event): event is TouchEvent {
  return touchNames.has(event.type) && 'touches' in event && 'changedTouches' in event
}

export function elementFromTarget(target: EventTarget): Element | undefined {
  return (target as Node).nodeType === 1 ? target as Element : undefined
}

export function resolveTouchCanvas(path: EventTarget[]) {
  const elements = path.map(elementFromTarget).filter((element): element is Element => Boolean(element))
  const canvas = elements.find(element => element.localName === 'weapp-canvas')
    ?? elements.find(element => element.localName === 'canvas')
  return canvas
    ? {
        canvas,
        surface: elements.find(element => element.localName === 'canvas') ?? canvas.shadowRoot?.querySelector('canvas') ?? canvas,
        legacyCanvas: canvas.localName === 'weapp-canvas' && canvas.getAttribute('type') !== '2d',
      }
    : undefined
}

export function markRuntimeTouchEvent(event: Event, data: RuntimeTouchData) {
  touchData.set(event, data)
}

export function getRuntimeTouchData(event: Event) {
  return touchData.get(event) ?? (isRuntimeTouchEvent(event)
    ? { source: event, ...resolveTouchCanvas(event.composedPath()) }
    : undefined)
}

/** 旧版 Canvas 使用特殊触摸通道，现代 2d Canvas 保留普通传播。 */
export function acceptsRuntimeTouchEvent(element: Element, event: Event) {
  const touch = getRuntimeTouchData(event)
  return !touch?.legacyCanvas || touch.canvas === element
}
