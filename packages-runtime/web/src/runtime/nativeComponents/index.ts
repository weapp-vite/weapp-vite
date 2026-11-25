import type { NativeComponentWebTag } from '../../shared/nativeComponents'
import { NATIVE_COMPONENT_DESCRIPTORS } from '../../shared/nativeComponents'
import { WeappNavigator } from './navigator'
import { VISUAL_WEB_COMPONENT_CONSTRUCTORS } from './registry'

const constructors = {
  ...VISUAL_WEB_COMPONENT_CONSTRUCTORS,
  'weapp-navigator': WeappNavigator,
} satisfies Record<NativeComponentWebTag, CustomElementConstructor>

export function ensureNativeComponentsDefined() {
  if (typeof customElements === 'undefined') {
    return
  }
  for (const descriptor of NATIVE_COMPONENT_DESCRIPTORS) {
    if (customElements.get(descriptor.webTag)) {
      continue
    }
    const constructor = constructors[descriptor.webTag]
    customElements.define(descriptor.webTag, constructor)
  }
}

export { collectCheckboxGroupValue } from './checkbox'
export { collectFormControlValues } from './formControl'
export { resolveIconColor, resolveIconSize, resolveIconType } from './icon/helpers'
export { resolveImageModeStyle } from './image'
export { createInputEventDetail } from './input'
export { clampMovablePosition, resolveMovableDirection } from './movable/helpers'
export {
  createPickerChangeDetail,
  normalizePickerIndexes,
  resolvePickerColumns,
  resolvePickerMode,
} from './picker/helpers'
export { normalizePickerViewValue } from './pickerView/helpers'
export {
  createProgressActiveEndDetail,
  resolveProgressAnimationDuration,
  resolveProgressConfig,
} from './progress/helpers'
export { collectRadioGroupValue } from './radio'
export { createScrollEventDetail } from './scrollView'
export { createSliderEventDetail, resolveSliderConfig } from './slider/helpers'
export { NATIVE_COMPONENT_STYLE } from './style'
export {
  createSwiperChangeDetail,
  resolveSwiperIndex,
  resolveSwiperNumber,
  resolveSwipeTarget,
} from './swiper/helpers'
export { createSwitchEventDetail } from './switch'
export { createTextareaLineChangeDetail } from './textarea'
export {
  createVideoProgressDetail,
  createVideoTimeUpdateDetail,
  resolveVideoObjectFit,
} from './video/helpers'
