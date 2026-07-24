import { NATIVE_COMPONENT_DESCRIPTORS } from '../../shared/nativeComponents'
import { ensureButtonDefined } from '../button'
import { WeappImage } from './image'
import { WeappInput } from './input'
import { WeappText, WeappView } from './primitives'
import { WeappScrollView } from './scrollView'

const constructors: Record<string, CustomElementConstructor> = {
  'weapp-view': WeappView,
  'weapp-text': WeappText,
  'weapp-image': WeappImage,
  'weapp-input': WeappInput,
  'weapp-scroll-view': WeappScrollView,
}

export function ensureNativeComponentsDefined() {
  if (typeof customElements === 'undefined') {
    return
  }
  ensureButtonDefined()
  for (const descriptor of NATIVE_COMPONENT_DESCRIPTORS) {
    if (descriptor.webTag === 'weapp-button' || customElements.get(descriptor.webTag)) {
      continue
    }
    const constructor = constructors[descriptor.webTag]
    if (constructor) {
      customElements.define(descriptor.webTag, constructor)
    }
  }
}

export { resolveImageModeStyle } from './image'
export { createInputEventDetail } from './input'
export { createScrollEventDetail } from './scrollView'
export { NATIVE_COMPONENT_STYLE } from './style'
