import type { RuntimeTouchPoint } from './data'
import { elementFromTarget, markRuntimeTouchEvent, resolveTouchCanvas } from './data'

interface MouseTouchSession {
  target: Element
  path: Element[]
  pointer: PointerEvent
  canvas?: Element
  surface?: Element
  legacyCanvas?: boolean
}

const coordinators = new WeakMap<Document, MouseTouchCoordinator>()

class MouseTouchCoordinator {
  #document: Document
  #window: Window
  #targets = new WeakMap<Element, number>()
  #registrations = 0
  #session?: MouseTouchSession

  constructor(owner: Document, view: Window) {
    this.#document = owner
    this.#window = view
  }

  register(element: Element) {
    this.#targets.set(element, (this.#targets.get(element) ?? 0) + 1)
    if (this.#registrations++ === 0) {
      this.#document.addEventListener('pointerdown', this.#start, true)
    }
    let active = true
    return () => {
      if (!active) {
        return
      }
      active = false
      const count = this.#targets.get(element) ?? 0
      if (count <= 1) {
        this.#targets.delete(element)
      }
      else {
        this.#targets.set(element, count - 1)
      }
      if (--this.#registrations === 0) {
        this.#document.removeEventListener('pointerdown', this.#start, true)
      }
      if (this.#session && !this.#isValid(this.#session)) {
        this.#finish()
      }
    }
  }

  #isValid(session: MouseTouchSession) {
    return session.target.isConnected
      && session.path.some(element => element.isConnected && this.#targets.has(element))
  }

  #start = (event: Event) => {
    const pointer = event as PointerEvent
    if (pointer.pointerType !== 'mouse' || pointer.button !== 0 || pointer.isPrimary === false) {
      return
    }
    // 鼠标可能在浏览器外松开；下一次按下明确终结未收到的旧会话。
    this.#finish('touchcancel', event)
    const path = event.composedPath().map(elementFromTarget).filter((element): element is Element => Boolean(element))
    const target = path[0]
    if (!target || !path.some(element => this.#targets.has(element))) {
      return
    }
    const session: MouseTouchSession = { target, path, pointer, ...resolveTouchCanvas(event.composedPath()) }
    this.#session = session
    this.#window.addEventListener('pointermove', this.#move, { capture: true, passive: false })
    this.#window.addEventListener('pointerup', this.#end, true)
    this.#window.addEventListener('pointercancel', this.#cancel, true)
    // blur 不冒泡；窗口只监听目标阶段，避免捕获页面元素的焦点切换。
    this.#window.addEventListener('blur', this.#blur)
    this.#dispatch(session, 'touchstart', pointer)
    // 业务回调允许同步卸载起始节点，不能留下可恢复的旧拖动会话。
    if (this.#session === session && !this.#isValid(session)) {
      this.#finish()
    }
  }

  #matches(event: Event, session: MouseTouchSession): event is PointerEvent {
    const pointer = event as PointerEvent
    return pointer.pointerType === 'mouse' && pointer.pointerId === session.pointer.pointerId
  }

  #move = (event: Event) => {
    const session = this.#session
    if (!session || !this.#matches(event, session)) {
      return
    }
    if (!this.#isValid(session)) {
      this.#finish()
      return
    }
    session.pointer = event
    if ((event.buttons & 1) === 0) {
      this.#finish('touchcancel', event)
      return
    }
    this.#dispatch(session, 'touchmove', event)
    if (this.#session === session && !this.#isValid(session)) {
      this.#finish()
    }
  }

  #end = (event: Event) => {
    const session = this.#session
    if (session && this.#matches(event, session)) {
      session.pointer = event
      this.#finish('touchend', event)
    }
  }

  #cancel = (event: Event) => {
    const session = this.#session
    if (session && this.#matches(event, session)) {
      session.pointer = event
      this.#finish('touchcancel', event)
    }
  }

  #blur = (event: Event) => this.#finish('touchcancel', event)

  #finish(name?: 'touchend' | 'touchcancel', source?: Event) {
    const session = this.#session
    if (!session) {
      return
    }
    this.#session = undefined
    this.#window.removeEventListener('pointermove', this.#move, true)
    this.#window.removeEventListener('pointerup', this.#end, true)
    this.#window.removeEventListener('pointercancel', this.#cancel, true)
    this.#window.removeEventListener('blur', this.#blur)
    if (name && source && this.#isValid(session)) {
      this.#dispatch(session, name, source)
    }
  }

  #dispatch(session: MouseTouchSession, name: string, source: Event) {
    const pointer = session.pointer
    const point: RuntimeTouchPoint = {
      identifier: pointer.pointerId,
      pageX: pointer.pageX,
      pageY: pointer.pageY,
      clientX: pointer.clientX,
      clientY: pointer.clientY,
      force: pointer.pressure,
    }
    const event = new Event(name, { bubbles: !session.legacyCanvas, composed: !session.legacyCanvas, cancelable: true })
    Object.defineProperties(event, {
      touches: { value: name === 'touchend' || name === 'touchcancel' ? [] : [point] },
      changedTouches: { value: [point] },
    })
    markRuntimeTouchEvent(event, { source, canvas: session.canvas, surface: session.surface, legacyCanvas: session.legacyCanvas })
    ;(session.legacyCanvas ? session.canvas! : session.target).dispatchEvent(event)
    if (event.defaultPrevented && source.cancelable) {
      source.preventDefault()
    }
  }
}

/** 登记触摸兴趣；所有组件共享文档协调器，只有拖动期间监听窗口后续事件。 */
export function registerRuntimeTouchTarget(element: Element): () => void {
  const owner = element.ownerDocument
  const view = owner.defaultView
  if (!view || typeof view.PointerEvent !== 'function') {
    return () => {}
  }
  let coordinator = coordinators.get(owner)
  if (!coordinator) {
    coordinator = new MouseTouchCoordinator(owner, view)
    coordinators.set(owner, coordinator)
  }
  return coordinator.register(element)
}
