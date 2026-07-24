import type { NativeComponentWebTag } from '../../shared/nativeComponents'
import { NATIVE_COMPONENT_DESCRIPTORS } from '../../shared/nativeComponents'
import { WeappButton } from '../button'
import { WeappCheckbox, WeappCheckboxGroup } from './checkbox'
import { WeappForm } from './form'
import { WeappImage } from './image'
import { WeappInput } from './input'
import { WeappLabel } from './label'
import { WeappNavigator } from './navigator'
import { WeappText, WeappView } from './primitives'
import { WeappRadio, WeappRadioGroup } from './radio'
import { WeappScrollView } from './scrollView'
import { WeappSwiper } from './swiper'
import { WeappSwiperItem } from './swiper/item'
import { WeappSwitch } from './switch'
import { WeappTextarea } from './textarea'

const constructors = {
  'weapp-view': WeappView,
  'weapp-text': WeappText,
  'weapp-image': WeappImage,
  'weapp-button': WeappButton,
  'weapp-input': WeappInput,
  'weapp-textarea': WeappTextarea,
  'weapp-form': WeappForm,
  'weapp-label': WeappLabel,
  'weapp-checkbox-group': WeappCheckboxGroup,
  'weapp-checkbox': WeappCheckbox,
  'weapp-radio-group': WeappRadioGroup,
  'weapp-radio': WeappRadio,
  'weapp-switch': WeappSwitch,
  'weapp-scroll-view': WeappScrollView,
  'weapp-navigator': WeappNavigator,
  'weapp-swiper': WeappSwiper,
  'weapp-swiper-item': WeappSwiperItem,
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
export { resolveImageModeStyle } from './image'
export { createInputEventDetail } from './input'
export { collectRadioGroupValue } from './radio'
export { createScrollEventDetail } from './scrollView'
export { NATIVE_COMPONENT_STYLE } from './style'
export {
  createSwiperChangeDetail,
  resolveSwiperIndex,
  resolveSwiperNumber,
  resolveSwipeTarget,
} from './swiper/helpers'
export { createSwitchEventDetail } from './switch'
export { createTextareaLineChangeDetail } from './textarea'
