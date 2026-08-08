import { getNativeComponentDescriptor } from '../../../shared/nativeComponents'
import { dispatchMiniProgramEvent, readBooleanAttribute, resolveContainingShadowRoot } from '../helpers'
import { ensureNativeComponentStyle } from '../style'
import {
  createProgressActiveEndDetail,
  resolveProgressAnimationDuration,
  resolveProgressConfig,
} from './helpers'
import { PROGRESS_SHADOW_STYLE } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

export class WeappProgress extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('progress')!.attributes]

  #value?: HTMLDivElement
  #info?: HTMLSpanElement
  #renderedPercent = 0
  #animationKey = ''
  #animationToken = 0
  #animationFrame?: number
  #animationTimer?: ReturnType<typeof globalThis.setTimeout>

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    this.#ensureStructure()
    this.#syncAttributes()
  }

  disconnectedCallback() {
    this.#cancelAnimation()
  }

  attributeChangedCallback() {
    this.#syncAttributes()
  }

  #ensureStructure() {
    if (this.#value || typeof document === 'undefined') {
      return
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = PROGRESS_SHADOW_STYLE
    const track = document.createElement('div')
    track.className = 'track'
    const value = document.createElement('div')
    value.className = 'value'
    const info = document.createElement('span')
    info.className = 'info'
    track.append(value)
    root.append(style, track, info)
    this.#value = value
    this.#info = info
  }

  #syncAttributes() {
    if (!this.#value || !this.#info) {
      return
    }
    const config = resolveProgressConfig({
      percent: this.getAttribute('percent'),
      strokeWidth: this.getAttribute('stroke-width'),
      duration: this.getAttribute('duration'),
      borderRadius: this.getAttribute('border-radius'),
      fontSize: this.getAttribute('font-size'),
      activeMode: this.getAttribute('active-mode'),
    })
    this.style.setProperty('--weapp-progress-stroke-width', `${config.strokeWidth}px`)
    this.style.setProperty('--weapp-progress-border-radius', `${config.borderRadius}px`)
    this.style.setProperty('--weapp-progress-font-size', `${config.fontSize}px`)
    this.style.setProperty('--weapp-progress-active-color', this.getAttribute('active-color') ?? this.getAttribute('color') ?? '#09bb07')
    this.style.setProperty('--weapp-progress-background-color', this.getAttribute('background-color') ?? '#ebebeb')
    this.#info.hidden = !readBooleanAttribute(this, 'show-info')

    if (!readBooleanAttribute(this, 'active')) {
      this.#animationKey = ''
      this.#cancelAnimation()
      this.#setProgress(config.percent, 0)
      this.#setInfo(config.percent)
      this.#renderedPercent = config.percent
      return
    }

    const animationKey = `${config.percent}:${config.duration}:${config.activeMode}`
    if (animationKey === this.#animationKey) {
      return
    }
    this.#animationKey = animationKey
    const start = config.activeMode === 'backwards' ? 0 : this.#renderedPercent
    this.#renderedPercent = config.percent
    this.#animate(
      start,
      config.percent,
      resolveProgressAnimationDuration(start, config.percent, config.duration),
    )
  }

  #setProgress(percent: number, duration: number) {
    this.style.setProperty('--weapp-progress-percent', `${percent}%`)
    this.style.setProperty('--weapp-progress-duration', `${duration}ms`)
  }

  #setInfo(percent: number) {
    this.#info!.textContent = `${Math.round(percent)}%`
  }

  #animate(start: number, end: number, duration: number) {
    this.#cancelAnimation()
    const token = ++this.#animationToken
    this.#setProgress(start, 0)
    this.#setInfo(start)
    void this.#value!.offsetWidth
    requestAnimationFrame((startTime) => {
      if (token !== this.#animationToken || !this.isConnected) {
        return
      }
      this.#setProgress(end, duration)
      if (duration === 0 || start === end) {
        queueMicrotask(() => this.#completeAnimation(token))
        return
      }
      this.#animateInfo(token, start, end, duration, startTime)
      this.#animationTimer = globalThis.setTimeout(
        () => this.#completeAnimation(token),
        duration + 50,
      )
    })
  }

  #animateInfo(token: number, start: number, end: number, duration: number, startTime: number) {
    const update = (time: number) => {
      if (token !== this.#animationToken || !this.isConnected) {
        return
      }
      const progress = Math.min(1, Math.max(0, (time - startTime) / duration))
      this.#setInfo(start + (end - start) * progress)
      if (progress < 1) {
        this.#animationFrame = requestAnimationFrame(update)
      }
    }
    this.#animationFrame = requestAnimationFrame(update)
  }

  #completeAnimation(token: number) {
    if (token !== this.#animationToken) {
      return
    }
    this.#cancelAnimation(false)
    this.#setInfo(this.#renderedPercent)
    dispatchMiniProgramEvent(this, 'activeend', createProgressActiveEndDetail())
  }

  #cancelAnimation(invalidate = true) {
    if (this.#animationFrame !== undefined) {
      cancelAnimationFrame(this.#animationFrame)
      this.#animationFrame = undefined
    }
    if (this.#animationTimer !== undefined) {
      globalThis.clearTimeout(this.#animationTimer)
      this.#animationTimer = undefined
    }
    if (invalidate) {
      this.#animationToken += 1
    }
  }
}

export * from './helpers'
