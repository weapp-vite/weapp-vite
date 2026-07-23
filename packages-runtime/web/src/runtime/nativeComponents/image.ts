import { getNativeComponentDescriptor } from '../../shared/nativeComponents'
import { dispatchMiniProgramEvent, readBooleanAttribute, resolveContainingShadowRoot } from './helpers'
import { ensureNativeComponentStyle } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

const IMAGE_MODE_STYLES: Record<string, { fit: string, position: string }> = {
  'scaleToFill': { fit: 'fill', position: 'center' },
  'aspectFit': { fit: 'contain', position: 'center' },
  'aspectFill': { fit: 'cover', position: 'center' },
  'top': { fit: 'none', position: 'top' },
  'bottom': { fit: 'none', position: 'bottom' },
  'center': { fit: 'none', position: 'center' },
  'left': { fit: 'none', position: 'left' },
  'right': { fit: 'none', position: 'right' },
  'top left': { fit: 'none', position: 'left top' },
  'top right': { fit: 'none', position: 'right top' },
  'bottom left': { fit: 'none', position: 'left bottom' },
  'bottom right': { fit: 'none', position: 'right bottom' },
}

export function resolveImageModeStyle(mode: string | null) {
  return IMAGE_MODE_STYLES[mode ?? 'scaleToFill'] ?? IMAGE_MODE_STYLES.scaleToFill!
}

export class WeappImage extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('image')!.attributes]

  #image?: HTMLImageElement

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    this.#ensureStructure()
    this.#syncAttributes()
  }

  attributeChangedCallback() {
    this.#syncAttributes()
  }

  #ensureStructure() {
    if (this.#image || typeof document === 'undefined') {
      return
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = `
      :host { position: relative; }
      img { display: block; width: 100%; height: 100%; }
    `
    const image = document.createElement('img')
    image.addEventListener('load', () => {
      dispatchMiniProgramEvent(this, 'load', {
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
    })
    image.addEventListener('error', () => {
      dispatchMiniProgramEvent(this, 'error', { errMsg: 'image load failed' })
    })
    root.append(style, image)
    this.#image = image
  }

  #syncAttributes() {
    if (!this.#image) {
      return
    }
    this.#image.src = this.getAttribute('src') ?? ''
    this.#image.alt = this.getAttribute('alt') ?? ''
    this.#image.loading = readBooleanAttribute(this, 'lazy-load') ? 'lazy' : 'eager'
    const mode = this.getAttribute('mode') ?? 'scaleToFill'
    const modeStyle = resolveImageModeStyle(mode)
    this.#image.style.objectFit = modeStyle.fit
    this.#image.style.objectPosition = modeStyle.position
    this.toggleAttribute('data-width-fix', mode === 'widthFix')
    this.toggleAttribute('data-height-fix', mode === 'heightFix')
    if (mode === 'widthFix') {
      this.#image.style.height = 'auto'
      this.style.height = 'auto'
    }
    else if (mode === 'heightFix') {
      this.#image.style.width = 'auto'
      this.style.width = 'auto'
    }
    else {
      this.#image.style.width = '100%'
      this.#image.style.height = '100%'
    }
  }
}
