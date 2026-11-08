/* eslint ts/no-use-before-define: ["warn", { "functions": false }] -- 闭包回调相互调用时使用函数提升，变量仍遵循先定义后使用。 */

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

const coordinators = new WeakMap<Document, ReturnType<typeof createMouseTouchCoordinator>>()

function createMouseTouchCoordinator(owner: Document, view: Window) {
  const targets = new WeakMap<Element, number>()
  let registrations = 0
  let currentSession: MouseTouchSession | undefined

  function register(element: Element) {
    targets.set(element, (targets.get(element) ?? 0) + 1)
    if (registrations++ === 0) {
      owner.addEventListener('pointerdown', start, true)
    }
    let active = true
    return () => {
      if (!active) {
        return
      }
      active = false
      // 每次登记先增加计数；闭包只释放一次，最后一次释放读取 1 后才删除。
      const count = targets.get(element)!
      if (count <= 1) {
        targets.delete(element)
      }
      else {
        targets.set(element, count - 1)
      }
      if (--registrations === 0) {
        owner.removeEventListener('pointerdown', start, true)
      }
      if (currentSession && !isValid(currentSession)) {
        finish()
      }
    }
  }

  function isValid(session: MouseTouchSession) {
    return session.target.isConnected
      && session.path.some(element => element.isConnected && targets.has(element))
  }

  function start(event: Event) {
    const pointer = event as PointerEvent
    if (pointer.pointerType !== 'mouse' || pointer.button !== 0 || pointer.isPrimary === false) {
      return
    }
    // 鼠标可能在浏览器外松开；下一次按下明确终结未收到的旧会话。
    finish('touchcancel', event)
    const path = event.composedPath().map(elementFromTarget).filter((element): element is Element => Boolean(element))
    const target = path[0]
    if (!target || !path.some(element => targets.has(element))) {
      return
    }
    const session: MouseTouchSession = { target, path, pointer, ...resolveTouchCanvas(event.composedPath()) }
    currentSession = session
    view.addEventListener('pointermove', move, { capture: true, passive: false })
    view.addEventListener('pointerup', end, true)
    view.addEventListener('pointercancel', cancel, true)
    // blur 不冒泡；窗口只监听目标阶段，避免捕获页面元素的焦点切换。
    view.addEventListener('blur', blur)
    dispatch(session, 'touchstart', pointer)
    // 业务回调允许同步卸载起始节点，不能留下可恢复的旧拖动会话。
    if (currentSession === session && !isValid(session)) {
      finish()
    }
  }

  function matches(event: Event, session: MouseTouchSession): event is PointerEvent {
    const pointer = event as PointerEvent
    return pointer.pointerType === 'mouse' && pointer.pointerId === session.pointer.pointerId
  }

  function move(event: Event) {
    const session = currentSession
    if (!session || !matches(event, session)) {
      return
    }
    if (!isValid(session)) {
      finish()
      return
    }
    session.pointer = event
    if ((event.buttons & 1) === 0) {
      finish('touchcancel', event)
      return
    }
    dispatch(session, 'touchmove', event)
    if (currentSession === session && !isValid(session)) {
      finish()
    }
  }

  function end(event: Event) {
    const session = currentSession
    if (session && matches(event, session)) {
      session.pointer = event
      finish('touchend', event)
    }
  }

  function cancel(event: Event) {
    const session = currentSession
    if (session && matches(event, session)) {
      session.pointer = event
      finish('touchcancel', event)
    }
  }

  function blur(event: Event) {
    finish('touchcancel', event)
  }

  function finish(name?: 'touchend' | 'touchcancel', source?: Event) {
    const session = currentSession
    if (!session) {
      return
    }
    currentSession = undefined
    view.removeEventListener('pointermove', move, true)
    view.removeEventListener('pointerup', end, true)
    view.removeEventListener('pointercancel', cancel, true)
    view.removeEventListener('blur', blur)
    if (name && source && isValid(session)) {
      dispatch(session, name, source)
    }
  }

  function dispatch(session: MouseTouchSession, name: string, source: Event) {
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

  return { register }
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
    coordinator = createMouseTouchCoordinator(owner, view)
    coordinators.set(owner, coordinator)
  }
  return coordinator.register(element)
}
