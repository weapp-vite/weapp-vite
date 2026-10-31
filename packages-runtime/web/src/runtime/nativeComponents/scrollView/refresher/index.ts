import { registerRuntimeTouchTarget } from '../../../touchEvents'
import { dispatchMiniProgramEvent, readBooleanAttribute } from '../../helpers'
import { createRefresherAppearance } from './appearance'

type Phase = 'idle' | 'pulling' | 'armed' | 'refreshing' | 'restoring'
interface Gesture { id: number, x: number, y: number, claimed: boolean }
const EVENT_OPTIONS = { bubbles: false, composed: false }
const RESTORE_DURATION = 180

/** 刷新只消费统一 touch 流；视觉位移与浏览器原生滚动会话相互独立。 */
export class ScrollViewRefresher {
  #phase: Phase = 'idle'
  #dy = 0
  #gesture?: Gesture
  #timer?: ReturnType<typeof setTimeout>
  #generation = 0
  #active = true
  #appearance: ReturnType<typeof createRefresherAppearance>
  #disposeTouch?: () => void

  constructor(private host: HTMLElement, private viewport: HTMLDivElement) {
    this.#appearance = createRefresherAppearance(host.shadowRoot!, viewport)
    host.addEventListener('touchstart', this.#start)
    host.addEventListener('touchmove', this.#move, { passive: false })
    host.addEventListener('touchend', this.#end)
    host.addEventListener('touchcancel', this.#cancel)
  }

  sync(name?: string) {
    this.#appearance.sync(this.host)
    if (!this.#enabled()) {
      this.#disposeTouch?.()
      this.#disposeTouch = undefined
      this.#reset()
      return
    }
    this.#disposeTouch ??= registerRuntimeTouchTarget(this.host)
    if (!name || name === 'refresher-triggered') {
      this.commit(readBooleanAttribute(this.host, 'refresher-triggered'))
    }
  }

  commit(value: unknown) {
    if (!this.#active || !this.#enabled() || this.#phase === 'restoring') {
      return
    }
    const triggered = value !== false && value !== null && value !== undefined && value !== 'false'
    if (triggered) {
      if (this.#phase !== 'refreshing') {
        this.#refresh(true)
      }
    }
    else if (this.#phase !== 'idle') {
      this.#restore(this.#phase === 'refreshing' ? 'refresherrestore' : 'refresherabort')
    }
  }

  destroy() {
    this.#active = false
    this.#reset()
    this.#disposeTouch?.()
    this.host.removeEventListener('touchstart', this.#start)
    this.host.removeEventListener('touchmove', this.#move)
    this.host.removeEventListener('touchend', this.#end)
    this.host.removeEventListener('touchcancel', this.#cancel)
    this.#appearance.remove()
  }

  #enabled() {
    return readBooleanAttribute(this.host, 'refresher-enabled') && readBooleanAttribute(this.host, 'scroll-y')
  }

  #threshold() {
    const value = Number(this.host.getAttribute('refresher-threshold') ?? 45)
    return Number.isFinite(value) && value >= 0 ? value : 45
  }

  #valid(generation: number) {
    return this.#active && this.host.isConnected && generation === this.#generation
  }

  #emit(name: string, dy = this.#dy) {
    dispatchMiniProgramEvent(this.host, name, { dy }, EVENT_OPTIONS)
  }

  #render() {
    this.#appearance.update(this.#dy, this.#phase)
  }

  #reset() {
    ++this.#generation
    clearTimeout(this.#timer)
    this.#timer = undefined
    this.#gesture = undefined
    this.#phase = 'idle'
    this.#dy = 0
    this.#render()
  }

  #refresh(programmatic: boolean) {
    clearTimeout(this.#timer)
    const generation = ++this.#generation
    this.#gesture = undefined
    this.#phase = 'refreshing'
    const dy = programmatic ? this.#threshold() + 10 : this.#dy
    this.#dy = this.#threshold() + 10
    this.#render()
    if (programmatic) {
      // 原生程序触发也先发 pulling，再在展开后发 refresh。
      this.#timer = setTimeout(() => {
        if (this.#valid(generation)) {
          this.#timer = undefined
          this.#emit('refresherrefresh')
        }
      }, RESTORE_DURATION)
      this.#emit('refresherpulling')
    }
    else {
      this.#emit('refresherrefresh', dy)
    }
  }

  #restore(event: 'refresherrestore' | 'refresherabort') {
    clearTimeout(this.#timer)
    const generation = ++this.#generation
    const dy = this.#dy
    this.#phase = 'restoring'
    this.#gesture = undefined
    this.#dy = 0
    this.#render()
    this.#timer = setTimeout(() => {
      if (this.#valid(generation)) {
        this.#timer = undefined
        this.#phase = 'idle'
        this.#render()
      }
    }, RESTORE_DURATION)
    this.#emit(event, dy)
  }

  #start = (event: Event) => {
    const touches = (event as TouchEvent).touches
    if (!this.#enabled() || this.#phase !== 'idle' || !touches || touches.length !== 1 || this.viewport.scrollTop > 0) {
      return
    }
    // 内层滚动容器和原生手势组件保留自己的输入所有权。
    for (const item of event.composedPath()) {
      if (item === this.host) {
        break
      }
      if (item instanceof Element && /^(?:weapp-scroll-view|weapp-swiper|weapp-movable-view|weapp-picker-view|weapp-canvas)$/.test(item.localName)) {
        return
      }
    }
    const touch = touches[0]!
    this.#gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, claimed: false }
  }

  #move = (event: Event) => {
    const gesture = this.#gesture
    if (!gesture) {
      return
    }
    const touches = (event as TouchEvent).touches
    const touch = touches && Array.from(touches).find(item => item.identifier === gesture.id)
    if (!touch || touches.length !== 1 || !event.cancelable || event.defaultPrevented || this.viewport.scrollTop > 0) {
      this.#cancel()
      return
    }
    const dy = touch.clientY - gesture.y
    const dx = Math.abs(touch.clientX - gesture.x)
    if (!gesture.claimed) {
      if (Math.max(Math.abs(dy), dx) < 4) {
        return
      }
      if (dy <= dx) {
        this.#gesture = undefined
        return
      }
      gesture.claimed = true
    }
    event.preventDefault()
    this.#dy = Math.min(Math.max(0, dy / 2), Math.max(this.#threshold() * 2, this.viewport.clientHeight / 2))
    this.#phase = this.#dy >= this.#threshold() ? 'armed' : 'pulling'
    this.#render()
    this.#emit('refresherpulling')
  }

  #end = (event: Event) => {
    const gesture = this.#gesture
    if (!gesture || Array.from((event as TouchEvent).touches ?? []).some(item => item.identifier === gesture.id)) {
      return
    }
    this.#gesture = undefined
    if (gesture.claimed) {
      if (this.#phase === 'armed') {
        this.#refresh(false)
      }
      else {
        this.#restore('refresherabort')
      }
    }
  }

  #cancel = () => {
    const claimed = this.#gesture?.claimed
    this.#gesture = undefined
    if (claimed) {
      this.#restore('refresherabort')
    }
  }
}
