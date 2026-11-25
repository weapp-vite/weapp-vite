import type { NativeComponentWebTag } from '../../shared/nativeComponents'
import { WeappButton } from '../button'
import { WeappCanvas } from './canvas'
import { WeappCheckbox, WeappCheckboxGroup } from './checkbox'
import { WeappCoverImage, WeappCoverView } from './cover'
import { WeappForm } from './form'
import { WeappIcon } from './icon'
import { WeappImage } from './image'
import { WeappInput } from './input'
import { WeappLabel } from './label'
import { WeappMovableArea, WeappMovableView } from './movable'
import { WeappPicker } from './picker'
import { WeappPickerView, WeappPickerViewColumn } from './pickerView'
import { WeappText, WeappView } from './primitives'
import { WeappProgress } from './progress'
import { WeappRadio, WeappRadioGroup } from './radio'
import { WeappRichText } from './richText'
import { WeappScrollView } from './scrollView'
import { WeappSlider } from './slider'
import { WeappSwiper } from './swiper'
import { WeappSwiperItem } from './swiper/item'
import { WeappSwitch } from './switch'
import { WeappTextarea } from './textarea'
import { WeappVideo } from './video'

/**
 * 需要页面栈或路由 host 的标签，不进入纯视觉注册表。
 */
export const ROUTE_COUPLED_WEB_TAGS = ['weapp-navigator'] as const satisfies readonly NativeComponentWebTag[]

/**
 * 纯 Web 宿主可直接使用的视觉元素构造器表。
 *
 * 类型上用 Exclude 排除路由耦合标签，新增原生组件标签时若未登记到这里会直接编译失败。
 */
export const VISUAL_WEB_COMPONENT_CONSTRUCTORS = {
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
  'weapp-picker': WeappPicker,
  'weapp-picker-view': WeappPickerView,
  'weapp-picker-view-column': WeappPickerViewColumn,
  'weapp-slider': WeappSlider,
  'weapp-icon': WeappIcon,
  'weapp-progress': WeappProgress,
  'weapp-rich-text': WeappRichText,
  'weapp-scroll-view': WeappScrollView,
  'weapp-swiper': WeappSwiper,
  'weapp-swiper-item': WeappSwiperItem,
  'weapp-canvas': WeappCanvas,
  'weapp-video': WeappVideo,
  'weapp-cover-view': WeappCoverView,
  'weapp-cover-image': WeappCoverImage,
  'weapp-movable-area': WeappMovableArea,
  'weapp-movable-view': WeappMovableView,
} satisfies Record<Exclude<NativeComponentWebTag, typeof ROUTE_COUPLED_WEB_TAGS[number]>, CustomElementConstructor>

/**
 * 视觉元素可注册的标签联合类型。
 */
export type VisualWebComponentTag = keyof typeof VISUAL_WEB_COMPONENT_CONSTRUCTORS

/**
 * 视觉元素可注册的标签列表。
 */
export const WEB_VISUAL_COMPONENT_TAGS = Object.keys(VISUAL_WEB_COMPONENT_CONSTRUCTORS) as VisualWebComponentTag[]
