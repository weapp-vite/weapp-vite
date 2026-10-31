import { readRuntimeDataset } from '../dataset'
import { getRuntimeTouchData, isRuntimeTouchEvent } from './data'

/** 编译模板与兼容模板使用同一事件形状和触摸取消语义。 */
export function createRuntimeEventPayload(name: string, event: Event, current: Element, catchEvent = false) {
  const touch = getRuntimeTouchData(event)
  if (catchEvent) {
    event.stopPropagation()
    if (event.type === 'touchmove' && isRuntimeTouchEvent(event)) {
      event.preventDefault()
    }
  }
  const dataset = readRuntimeDataset(current)
  const target = event.target as Element | null
  const canvasTarget = (element: Element, values = readRuntimeDataset(element)) => ({
    id: element.id,
    offsetLeft: (element as HTMLElement).offsetLeft,
    offsetTop: (element as HTMLElement).offsetTop,
    dataset: values,
  })
  const payload = {
    type: name,
    timeStamp: event.timeStamp,
    detail: (event as CustomEvent).detail ?? (event as InputEvent).data ?? undefined,
    target: touch?.canvas && !touch.legacyCanvas && target
      ? canvasTarget(target)
      : { dataset: target ? readRuntimeDataset(target) : dataset },
    ...(!touch?.legacyCanvas
      ? {
          currentTarget: touch?.canvas
            ? canvasTarget(current, dataset)
            : { dataset },
        }
      : {}),
    originalEvent: touch?.source ?? event,
  }
  if (!isRuntimeTouchEvent(event)) {
    return payload
  }
  const rect = touch?.surface?.getBoundingClientRect()
  const copy = (points: TouchList) => Array.from(points, (point) => {
    const standard = {
      identifier: point.identifier,
      pageX: point.pageX,
      pageY: point.pageY,
      clientX: point.clientX,
      clientY: point.clientY,
      ...(typeof point.force === 'number' ? { force: point.force } : {}),
    }
    if (!rect) {
      return standard
    }
    return {
      ...(touch?.legacyCanvas ? { identifier: point.identifier } : standard),
      x: point.clientX - rect.left,
      y: point.clientY - rect.top,
    }
  })
  return { ...payload, touches: copy(event.touches), changedTouches: copy(event.changedTouches) }
}
