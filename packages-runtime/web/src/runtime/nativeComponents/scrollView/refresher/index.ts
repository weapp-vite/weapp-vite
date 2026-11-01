/* eslint ts/no-use-before-define: ["warn", { "functions": false }] -- 闭包回调相互调用时使用函数提升，变量仍遵循先定义后使用。 */

import { registerRuntimeTouchTarget } from '../../../touchEvents'
import { dispatchMiniProgramEvent, readBooleanAttribute } from '../../helpers'
import { createRefresherAppearance } from './appearance'

type Phase = 'idle' | 'pulling' | 'armed' | 'refreshing' | 'restoring'
interface Gesture { id: number, x: number, y: number, claimed: boolean }
const EVENT_OPTIONS = { bubbles: false, composed: false }
const RESTORE_DURATION = 180

/** 刷新只消费统一 touch 流；视觉位移与浏览器原生滚动会话相互独立。 */
export function createScrollViewRefresher(host: HTMLElement, viewport: HTMLDivElement) {
  let phase: Phase = 'idle'
  let offset = 0
  let currentGesture: Gesture | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let transitionGeneration = 0
  let active = true
  let disposeTouch: (() => void) | undefined
  const appearance = createRefresherAppearance(host.shadowRoot!, viewport)

  function sync(name?: string) {
    appearance.sync(host)
    if (!enabled()) {
      disposeTouch?.()
      disposeTouch = undefined
      reset()
      return
    }
    disposeTouch ??= registerRuntimeTouchTarget(host)
    if (!name || name === 'refresher-triggered') {
      commit(readBooleanAttribute(host, 'refresher-triggered'))
    }
  }

  function commit(value: unknown) {
    if (!active || !enabled() || phase === 'restoring') {
      return
    }
    const triggered = value !== false && value !== null && value !== undefined && value !== 'false'
    if (triggered) {
      if (phase !== 'refreshing') {
        refresh(true)
      }
    }
    else if (phase !== 'idle') {
      restore(phase === 'refreshing' ? 'refresherrestore' : 'refresherabort')
    }
  }

  function destroy() {
    active = false
    reset()
    disposeTouch?.()
    host.removeEventListener('touchstart', start)
    host.removeEventListener('touchmove', move)
    host.removeEventListener('touchend', end)
    host.removeEventListener('touchcancel', cancel)
    appearance.remove()
  }

  function enabled() {
    return readBooleanAttribute(host, 'refresher-enabled') && readBooleanAttribute(host, 'scroll-y')
  }

  function threshold() {
    const value = Number(host.getAttribute('refresher-threshold') ?? 45)
    return Number.isFinite(value) && value >= 0 ? value : 45
  }

  function valid(generation: number) {
    return active && host.isConnected && generation === transitionGeneration
  }

  function emit(name: string, dy = offset) {
    dispatchMiniProgramEvent(host, name, { dy }, EVENT_OPTIONS)
  }

  function render() {
    appearance.update(offset, phase)
  }

  function reset() {
    ++transitionGeneration
    clearTimeout(timer)
    timer = undefined
    currentGesture = undefined
    phase = 'idle'
    offset = 0
    render()
  }

  function refresh(programmatic: boolean) {
    clearTimeout(timer)
    const generation = ++transitionGeneration
    currentGesture = undefined
    phase = 'refreshing'
    const dy = programmatic ? threshold() + 10 : offset
    offset = threshold() + 10
    render()
    if (programmatic) {
      // 原生程序触发也先发 pulling，再在展开后发 refresh。
      timer = setTimeout(() => {
        if (valid(generation)) {
          timer = undefined
          emit('refresherrefresh')
        }
      }, RESTORE_DURATION)
      emit('refresherpulling')
    }
    else {
      emit('refresherrefresh', dy)
    }
  }

  function restore(event: 'refresherrestore' | 'refresherabort') {
    clearTimeout(timer)
    const generation = ++transitionGeneration
    const dy = offset
    phase = 'restoring'
    currentGesture = undefined
    offset = 0
    render()
    timer = setTimeout(() => {
      if (valid(generation)) {
        timer = undefined
        phase = 'idle'
        render()
      }
    }, RESTORE_DURATION)
    emit(event, dy)
  }

  function start(event: Event) {
    const touches = (event as TouchEvent).touches
    if (!enabled() || phase !== 'idle' || !touches || touches.length !== 1 || viewport.scrollTop > 0) {
      return
    }
    // 内层滚动容器和原生手势组件保留自己的输入所有权。
    for (const item of event.composedPath()) {
      if (item === host) {
        break
      }
      if (item instanceof Element && /^(?:weapp-scroll-view|weapp-swiper|weapp-movable-view|weapp-picker-view|weapp-canvas)$/.test(item.localName)) {
        return
      }
    }
    const touch = touches[0]!
    currentGesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, claimed: false }
  }

  function move(event: Event) {
    const gesture = currentGesture
    if (!gesture) {
      return
    }
    const touches = (event as TouchEvent).touches
    const touch = touches && Array.from(touches).find(item => item.identifier === gesture.id)
    if (!touch || touches.length !== 1 || !event.cancelable || event.defaultPrevented || viewport.scrollTop > 0) {
      cancel()
      return
    }
    const dy = touch.clientY - gesture.y
    const dx = Math.abs(touch.clientX - gesture.x)
    if (!gesture.claimed) {
      if (Math.max(Math.abs(dy), dx) < 4) {
        return
      }
      if (dy <= dx) {
        currentGesture = undefined
        return
      }
      gesture.claimed = true
    }
    event.preventDefault()
    offset = Math.min(Math.max(0, dy / 2), Math.max(threshold() * 2, viewport.clientHeight / 2))
    phase = offset >= threshold() ? 'armed' : 'pulling'
    render()
    emit('refresherpulling')
  }

  function end(event: Event) {
    const gesture = currentGesture
    if (!gesture || Array.from((event as TouchEvent).touches ?? []).some(item => item.identifier === gesture.id)) {
      return
    }
    currentGesture = undefined
    if (gesture.claimed) {
      if (phase === 'armed') {
        refresh(false)
      }
      else {
        restore('refresherabort')
      }
    }
  }

  function cancel() {
    const claimed = currentGesture?.claimed
    currentGesture = undefined
    if (claimed) {
      restore('refresherabort')
    }
  }

  host.addEventListener('touchstart', start)
  host.addEventListener('touchmove', move, { passive: false })
  host.addEventListener('touchend', end)
  host.addEventListener('touchcancel', cancel)
  return { sync, commit, destroy }
}
