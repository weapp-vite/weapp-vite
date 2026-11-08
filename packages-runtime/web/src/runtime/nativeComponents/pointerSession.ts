/** 原生控件拥有自己的指针捕获；临时会话负责统一异常取消与幂等释放。 */
export function watchNativePointerSession(element: Element, pointer: PointerEvent, onCancel: () => void) {
  const view = element.ownerDocument.defaultView
  const pointerId = Number.isFinite(pointer.pointerId) ? pointer.pointerId : 0
  const subscriptions: Array<() => void> = []
  let active = true
  function dispose() {
    if (!active) {
      return
    }
    active = false
    for (const release of subscriptions.splice(0)) {
      release()
    }
    if (!element.hasPointerCapture || element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture?.(pointerId)
    }
  }
  function cancel() {
    // dispose 先解绑全部取消入口，再通知业务；失效会话无法再次进入此回调。
    dispose()
    onCancel()
  }
  function matches(event: Event) {
    const current = (event as PointerEvent).pointerId
    return (Number.isFinite(current) ? current : 0) === pointerId
  }
  function interrupted(event: Event) {
    if (matches(event)) {
      cancel()
    }
  }
  function restart(event: Event) {
    if (matches(event) || (pointer.pointerType === 'mouse' && (event as PointerEvent).pointerType === 'mouse')) {
      cancel()
    }
  }
  function move(event: Event) {
    const current = event as PointerEvent
    if (matches(event) && (!element.isConnected || (current.pointerType === 'mouse' && (current.buttons & 1) === 0))) {
      cancel()
    }
  }
  const listen = (target: EventTarget | null, name: string, listener: EventListener, capture = false) => {
    target?.addEventListener(name, listener, capture)
    subscriptions.push(() => target?.removeEventListener(name, listener, capture))
  }
  // blur 不冒泡；不要在捕获阶段把元素失焦当作窗口离开。
  listen(view, 'blur', cancel)
  listen(view, 'pointermove', move, true)
  listen(view, 'pointerdown', restart, true)
  listen(view, 'pointercancel', interrupted, true)
  listen(view, 'pointerup', interrupted)
  listen(element, 'lostpointercapture', interrupted)
  element.setPointerCapture?.(pointerId)
  return dispose
}
