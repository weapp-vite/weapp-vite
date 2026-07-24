import { getNativeComponentDescriptor } from '../../../shared/nativeComponents'
import { dispatchMiniProgramEvent, readBooleanAttribute, resolveContainingShadowRoot } from '../helpers'
import { registerNativeMediaElement, unregisterNativeMediaElement } from '../mediaRegistry'
import { ensureNativeComponentStyle } from '../style'
import {
  createVideoProgressDetail,
  createVideoTimeUpdateDetail,
  resolveVideoDirection,
  resolveVideoObjectFit,
} from './helpers'
import { VIDEO_SHADOW_STYLE } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

function readFiniteNumber(value: string | null) {
  if (value === null || value.trim() === '') {
    return undefined
  }
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function resolveBufferedEnd(video: HTMLVideoElement) {
  const { buffered } = video
  if (!buffered || buffered.length === 0) {
    return 0
  }
  try {
    return buffered.end(buffered.length - 1)
  }
  catch {
    return 0
  }
}

export class WeappVideo extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('video')!.attributes]

  #video?: HTMLVideoElement
  #fullscreenTarget?: Document

  get videoElement() {
    return this.#video
  }

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    this.#ensureStructure()
    this.#syncAttributes()
    this.#connectFullscreenListener()
  }

  disconnectedCallback() {
    if (this.#video) {
      unregisterNativeMediaElement(this.#video)
    }
    this.#fullscreenTarget?.removeEventListener('fullscreenchange', this.#handleFullscreenChange)
    this.#fullscreenTarget = undefined
  }

  attributeChangedCallback() {
    this.#syncAttributes()
  }

  #ensureStructure() {
    if (this.#video || typeof document === 'undefined') {
      return
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = VIDEO_SHADOW_STYLE
    const video = document.createElement('video')
    for (const eventName of ['play', 'pause', 'ended', 'waiting'] as const) {
      video.addEventListener(eventName, (event) => {
        event.stopPropagation()
        dispatchMiniProgramEvent(this, eventName, {})
      })
    }
    video.addEventListener('timeupdate', (event) => {
      event.stopPropagation()
      dispatchMiniProgramEvent(this, 'timeupdate', createVideoTimeUpdateDetail(video.currentTime, video.duration))
    })
    video.addEventListener('progress', (event) => {
      event.stopPropagation()
      dispatchMiniProgramEvent(this, 'progress', createVideoProgressDetail(resolveBufferedEnd(video), video.duration))
    })
    video.addEventListener('loadedmetadata', (event) => {
      event.stopPropagation()
      dispatchMiniProgramEvent(this, 'loadedmetadata', {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
      })
    })
    video.addEventListener('error', (event) => {
      event.stopPropagation()
      dispatchMiniProgramEvent(this, 'error', {
        errMsg: video.error?.message || 'video load failed',
      })
    })
    root.append(style, video)
    this.#video = video
  }

  #syncAttributes() {
    const video = this.#video
    if (!video) {
      return
    }
    const src = this.getAttribute('src')
    if (src) {
      video.src = src
    }
    else {
      video.removeAttribute('src')
    }
    video.poster = this.getAttribute('poster') ?? ''
    video.autoplay = readBooleanAttribute(this, 'autoplay')
    video.loop = readBooleanAttribute(this, 'loop')
    video.muted = readBooleanAttribute(this, 'muted')
    video.controls = this.getAttribute('controls') === null || readBooleanAttribute(this, 'controls')
    video.style.objectFit = resolveVideoObjectFit(this.getAttribute('object-fit'))
    const initialTime = readFiniteNumber(this.getAttribute('initial-time'))
    if (initialTime !== undefined && initialTime >= 0) {
      try {
        video.currentTime = initialTime
      }
      catch {
        // ignore browsers that block currentTime mutation before metadata loads
      }
    }
    registerNativeMediaElement('video', [this.getAttribute('id')], video)
  }

  #connectFullscreenListener() {
    const target = this.ownerDocument ?? (typeof document === 'undefined' ? undefined : document)
    if (!target || this.#fullscreenTarget === target) {
      return
    }
    this.#fullscreenTarget?.removeEventListener('fullscreenchange', this.#handleFullscreenChange)
    target.addEventListener('fullscreenchange', this.#handleFullscreenChange)
    this.#fullscreenTarget = target
  }

  #handleFullscreenChange = () => {
    const video = this.#video
    const target = this.#fullscreenTarget
    if (!video || !target) {
      return
    }
    dispatchMiniProgramEvent(this, 'fullscreenchange', {
      fullScreen: target.fullscreenElement === video,
      direction: resolveVideoDirection(video.videoWidth, video.videoHeight),
    })
  }
}
