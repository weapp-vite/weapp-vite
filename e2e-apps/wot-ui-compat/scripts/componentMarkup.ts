export interface ComponentMarkup {
  markup: string
  parent?: string
  setup?: string
  interaction?: ComponentInteraction
}

export type ComponentInteraction = {
  type: 'command'
  method: string
  commandTarget?: 'component' | 'parent'
  delayBefore?: number
  delayAfter?: number
  args?: readonly unknown[]
  event?: string
  eventTarget?: 'component' | 'parent'
  expect?: {
    binding: string
    value: unknown
  }
  expectTarget?: {
    method: string
    value: unknown
  }
} | {
  type: 'model'
  model: string
  value: unknown
  event?: string
}

const MODEL_SETUP = `const modelValue = ref('option-a')`
const BOOLEAN_MODEL_SETUP = `const modelValue = ref(false)`
const OPTIONS_SETUP = `const options = [
  { label: 'Option A', value: 'option-a' },
  { label: 'Option B', value: 'option-b' },
]`

const overrides: Record<string, ComponentMarkup> = {
  'wd-action-sheet': {
    setup: `const modelValue = ref(true)\nconst actions = [{ name: 'Action A' }, { name: 'Action B' }]`,
    markup: '<wd-action-sheet v-model="modelValue" :actions="actions" :close-on-click-action="false" />',
  },
  'wd-avatar': { markup: '<wd-avatar text="WU" size="large" />' },
  'wd-avatar-group': { parent: 'wd-avatar-group', markup: '<wd-avatar-group><wd-avatar text="A" /><wd-avatar text="B" /></wd-avatar-group>' },
  'wd-badge': { markup: '<wd-badge :value="8"><view class="badge-anchor">Badge</view></wd-badge>' },
  'wd-button': { markup: '<wd-button type="primary">Primary button</wd-button>' },
  'wd-calendar': {
    setup: `const modelValue = ref<number[]>([Date.UTC(2025, 0, 15)])
const minDate = Date.UTC(2024, 11, 1)
const maxDate = Date.UTC(2025, 1, 28)`,
    markup: '<wd-calendar v-model="modelValue" :min-date="minDate" :max-date="maxDate" label="Date" type="dates" />',
  },
  'wd-calendar-view': {
    setup: `const modelValue = ref(Date.UTC(2025, 0, 15))
const minDate = Date.UTC(2024, 11, 1)
const maxDate = Date.UTC(2025, 1, 28)`,
    markup: '<wd-calendar-view v-model="modelValue" :min-date="minDate" :max-date="maxDate" />',
  },
  'wd-card': { markup: '<wd-card title="Compatibility card"><view>Stable card content</view></wd-card>' },
  'wd-cascader': { setup: `${MODEL_SETUP}\n${OPTIONS_SETUP}`, markup: '<wd-cascader v-model="modelValue" :options="options" />' },
  'wd-cell': { markup: '<wd-cell title="Status" value="Ready" label="Representative cell" clickable />' },
  'wd-cell-group': { parent: 'wd-cell-group', markup: '<wd-cell-group title="Group"><wd-cell title="Status" value="Ready" /></wd-cell-group>' },
  'wd-checkbox': { setup: BOOLEAN_MODEL_SETUP, markup: '<wd-checkbox v-model="modelValue">Checkbox</wd-checkbox>' },
  'wd-checkbox-group': { setup: `const modelValue = ref<string[]>(['option-a'])`, parent: 'wd-checkbox-group', markup: '<wd-checkbox-group v-model="modelValue"><wd-checkbox model-value="option-a">Option A</wd-checkbox></wd-checkbox-group>' },
  'wd-circle': { setup: `const modelValue = ref(64)`, markup: '<wd-circle v-model="modelValue" text="64%" />' },
  'wd-col': { parent: 'wd-row', markup: '<wd-row :gutter="12"><wd-col :span="12"><view class="grid-block">Column</view></wd-col></wd-row>' },
  'wd-collapse': { setup: `const modelValue = ref<string[]>(['item'])`, parent: 'wd-collapse', markup: '<wd-collapse v-model="modelValue"><wd-collapse-item name="item" title="Item">Expanded content</wd-collapse-item></wd-collapse>' },
  'wd-collapse-item': { setup: `const modelValue = ref<string[]>(['item'])`, parent: 'wd-collapse', markup: '<wd-collapse v-model="modelValue"><wd-collapse-item name="item" title="Standalone item">Expanded content</wd-collapse-item></wd-collapse>' },
  'wd-config-provider': { parent: 'wd-config-provider', markup: '<wd-config-provider><wd-button type="primary">Provided button</wd-button></wd-config-provider>' },
  'wd-count-down': { markup: '<wd-count-down :time="65000" format="mm:ss" :auto-start="false" />' },
  'wd-count-to': { markup: '<wd-count-to :start-val="0" :end-val="128" :duration="0" />' },
  'wd-curtain': { setup: `const modelValue = ref(true)`, markup: '<wd-curtain v-model="modelValue" src="/assets/sample.png" :width="300" />' },
  'wd-datetime-picker': { setup: `const modelValue = ref(Date.UTC(2025, 0, 15, 8, 0))`, markup: '<wd-datetime-picker v-model="modelValue" label="Datetime" />' },
  'wd-datetime-picker-view': { setup: `const modelValue = ref(Date.UTC(2025, 0, 15, 8, 0))`, markup: '<wd-datetime-picker-view v-model="modelValue" />' },
  'wd-dialog': { setup: `const modelValue = ref(true)`, markup: '<wd-dialog v-model="modelValue" title="Dialog"><view>Dialog content</view></wd-dialog>' },
  'wd-divider': { markup: '<wd-divider>Divider label</wd-divider>' },
  'wd-drop-menu': { setup: `${MODEL_SETUP}\n${OPTIONS_SETUP}`, parent: 'wd-drop-menu', markup: '<wd-drop-menu><wd-drop-menu-item v-model="modelValue" :options="options" title="Option A" /></wd-drop-menu>' },
  'wd-drop-menu-item': { setup: `${MODEL_SETUP}\n${OPTIONS_SETUP}`, parent: 'wd-drop-menu', markup: '<wd-drop-menu><wd-drop-menu-item v-model="modelValue" :options="options" title="Option A" /></wd-drop-menu>' },
  'wd-empty': { markup: '<wd-empty description="No data" />' },
  'wd-form': { setup: `const formModel = { name: 'Wot UI' }\nconst formSchema = { validate: () => [] }`, parent: 'wd-form', markup: '<wd-form :model="formModel" :schema="formSchema"><wd-form-item label="Name" prop="name"><wd-input v-model="formModel.name" /></wd-form-item></wd-form>' },
  'wd-form-item': { setup: `const formModel = { name: 'Wot UI' }`, parent: 'wd-form', markup: '<wd-form :model="formModel"><wd-form-item label="Name" prop="name"><wd-input v-model="formModel.name" /></wd-form-item></wd-form>' },
  'wd-grid': { parent: 'wd-grid', markup: '<wd-grid :column="2"><wd-grid-item icon="home" text="Home" /><wd-grid-item icon="user" text="Profile" /></wd-grid>' },
  'wd-grid-item': { parent: 'wd-grid', markup: '<wd-grid :column="1" :clickable="true"><wd-grid-item icon="home" text="Grid item" /></wd-grid>' },
  'wd-icon': { markup: '<wd-icon name="check" size="24px" color="#16a34a" />' },
  'wd-img': { markup: '<wd-img width="120" height="80" src="/assets/sample.png" mode="aspectFill" />' },
  'wd-index-anchor': { parent: 'wd-index-bar', markup: '<wd-index-bar><wd-index-anchor index="A" /><wd-cell title="Alpha" /></wd-index-bar>' },
  'wd-index-bar': { parent: 'wd-index-bar', markup: '<wd-index-bar><wd-index-anchor index="A" /><wd-cell title="Alpha" /></wd-index-bar>' },
  'wd-input': { setup: `const modelValue = ref('Ready')`, markup: '<wd-input v-model="modelValue" label="Input" clearable />' },
  'wd-input-number': { setup: `const modelValue = ref(2)`, markup: '<wd-input-number v-model="modelValue" :min="0" :max="5" />' },
  'wd-keyboard': { setup: BOOLEAN_MODEL_SETUP, markup: '<wd-keyboard v-model="modelValue" mode="custom" />' },
  'wd-loading': { markup: '<wd-loading size="28px">Loading</wd-loading>' },
  'wd-loadmore': { markup: '<wd-loadmore state="error" error-text="Retry loading" />' },
  'wd-notice-bar': { markup: '<wd-notice-bar text="Stable compatibility notice" :scrollable="false" />' },
  'wd-pagination': { setup: `const modelValue = ref(2)`, markup: '<wd-pagination v-model="modelValue" :total="60" :page-size="10" />' },
  'wd-password-input': { setup: `const modelValue = ref('1234')`, markup: '<wd-password-input v-model="modelValue" :length="6" />' },
  'wd-picker': { setup: `${MODEL_SETUP}\n${OPTIONS_SETUP}\nconst columns = options`, markup: '<wd-picker v-model="modelValue" :columns="columns" label="Picker" />' },
  'wd-picker-view': { setup: `${MODEL_SETUP}\n${OPTIONS_SETUP}\nconst columns = [options]`, markup: '<wd-picker-view v-model="modelValue" :columns="columns" />' },
  'wd-progress': { markup: '<wd-progress :percentage="64" color="#16a34a" />' },
  'wd-radio': { setup: `const modelValue = ref('option-b')`, parent: 'wd-radio-group', markup: '<wd-radio-group v-model="modelValue"><wd-radio value="option-a">Option A</wd-radio></wd-radio-group>' },
  'wd-radio-group': { setup: MODEL_SETUP, parent: 'wd-radio-group', markup: '<wd-radio-group v-model="modelValue"><wd-radio value="option-a">Option A</wd-radio><wd-radio value="option-b">Option B</wd-radio></wd-radio-group>' },
  'wd-rate': { setup: `const modelValue = ref(4)`, markup: '<wd-rate v-model="modelValue" :count="5" />' },
  'wd-row': { parent: 'wd-row', markup: '<wd-row :gutter="12"><wd-col :span="12"><view class="grid-block">Left</view></wd-col><wd-col :span="12"><view class="grid-block">Right</view></wd-col></wd-row>' },
  'wd-search': { setup: `const modelValue = ref('Wot UI')`, markup: '<wd-search v-model="modelValue" placeholder="Search" />' },
  'wd-segmented': { setup: `${MODEL_SETUP}\n${OPTIONS_SETUP}`, markup: '<wd-segmented v-model:value="modelValue" :options="options" />' },
  'wd-select-picker': { setup: `${MODEL_SETUP}\n${OPTIONS_SETUP}`, markup: '<wd-select-picker v-model="modelValue" :columns="options" label="Select" />' },
  'wd-sidebar': { setup: `const modelValue = ref(0)`, parent: 'wd-sidebar', markup: '<wd-sidebar v-model="modelValue"><wd-sidebar-item label="First" /><wd-sidebar-item label="Second" /></wd-sidebar>' },
  'wd-sidebar-item': { setup: `const modelValue = ref(0)`, parent: 'wd-sidebar', markup: '<wd-sidebar v-model="modelValue"><wd-sidebar-item label="Standalone item" /></wd-sidebar>' },
  'wd-slider': { setup: `const modelValue = ref(40)`, markup: '<wd-slider v-model="modelValue" :min="0" :max="100" />' },
  'wd-step': { setup: `const modelValue = ref(1)`, parent: 'wd-steps', markup: '<wd-steps v-model="modelValue"><wd-step title="Done" /><wd-step title="Current" /></wd-steps>' },
  'wd-steps': { setup: `const modelValue = ref(1)`, parent: 'wd-steps', markup: '<wd-steps v-model="modelValue"><wd-step title="Done" /><wd-step title="Current" /></wd-steps>' },
  'wd-swiper': { setup: `const modelValue = ref(0)\nconst swiperItems = ['/assets/sample.png', '/assets/sample-alt.png']`, parent: 'wd-swiper', markup: '<wd-swiper v-model:current="modelValue" :list="swiperItems" :autoplay="false" />' },
  'wd-swiper-nav': { setup: `const modelValue = ref(0)`, parent: 'wd-swiper', markup: '<wd-swiper-nav v-model="modelValue" :total="2" />' },
  'wd-switch': { setup: `const modelValue = ref(true)`, markup: '<wd-switch v-model="modelValue" />' },
  'wd-tab': { setup: `const modelValue = ref('first')`, parent: 'wd-tabs', markup: '<wd-tabs v-model="modelValue"><wd-tab name="first" title="First">Tab content</wd-tab></wd-tabs>' },
  'wd-tabbar': { setup: `const modelValue = ref(0)`, parent: 'wd-tabbar', markup: '<wd-tabbar v-model="modelValue" fixed="false"><wd-tabbar-item title="Home" icon="home" /><wd-tabbar-item title="Profile" icon="user" /></wd-tabbar>' },
  'wd-tabbar-item': { setup: `const modelValue = ref(0)`, parent: 'wd-tabbar', markup: '<wd-tabbar v-model="modelValue" fixed="false"><wd-tabbar-item title="Home" icon="home" /></wd-tabbar>' },
  'wd-table': { setup: `const tableData = [{ name: 'Alice', score: 98 }]`, parent: 'wd-table', markup: '<wd-table :data="tableData"><wd-table-column prop="name" label="Name" /><wd-table-column prop="score" label="Score" /></wd-table>' },
  'wd-table-column': { setup: `const tableData = [{ name: 'Alice' }]`, parent: 'wd-table', markup: '<wd-table :data="tableData"><wd-table-column prop="name" label="Name" /></wd-table>' },
  'wd-tabs': { setup: `const modelValue = ref('first')`, parent: 'wd-tabs', markup: '<wd-tabs v-model="modelValue"><wd-tab name="first" title="First">First tab</wd-tab><wd-tab name="second" title="Second">Second tab</wd-tab></wd-tabs>' },
  'wd-tag': { markup: '<wd-tag type="primary" round>Stable tag</wd-tag>' },
  'wd-text': { markup: '<wd-text text="Stable text content" :lines="2" />' },
  'wd-textarea': { setup: `const modelValue = ref('Textarea content')`, markup: '<wd-textarea v-model="modelValue" label="Notes" :maxlength="80" />' },
  'wd-transition': { markup: '<wd-transition :show="true" name="fade"><view class="transition-content">Visible transition</view></wd-transition>' },
  'wd-upload': { setup: `const modelValue = ref<Array<{ url: string }>>([{ url: '/assets/sample.png' }])`, markup: '<wd-upload v-model:file-list="modelValue" :limit="1" />' },
  'wd-watermark': { markup: '<wd-watermark content="Wot UI"><view class="watermark-content">Watermark area</view></wd-watermark>' },
  'wd-backtop': { markup: '<wd-backtop :scroll-top="500" :top="100" text="Top" />' },
  'wd-fab': { markup: '<wd-fab><wd-button size="small">Action</wd-button></wd-fab>' },
  'wd-floating-panel': {
    markup: '<wd-floating-panel :anchors="floatingAnchors" :height="120"><view class="floating-content">Floating panel</view></wd-floating-panel>',
    setup: 'const floatingAnchors = [120, 240]',
  },
  'wd-gap': { markup: '<wd-gap height="32" bg-color="#dbeafe" />' },
  'wd-image-preview': { markup: '<wd-image-preview :images="[\'/assets/sample.png\', \'/assets/sample-alt.png\']" />' },
  'wd-img-cropper': { setup: `const modelValue = ref(true)`, markup: '<wd-img-cropper v-model="modelValue" img-src="/assets/sample.png" />' },
  'wd-navbar': { markup: '<wd-navbar title="Compatibility" left-text="Back" right-text="Done" />' },
  'wd-navbar-capsule': { markup: '<wd-navbar-capsule />' },
  'wd-notify': { markup: '<wd-notify />' },
  'wd-overlay': { markup: '<wd-overlay :show="true"><view class="overlay-content">Overlay content</view></wd-overlay>' },
  'wd-popover': { setup: BOOLEAN_MODEL_SETUP, markup: '<wd-popover v-model="modelValue" content="Popover content"><wd-button size="small">Popover</wd-button></wd-popover>' },
  'wd-popup': { setup: `const modelValue = ref(true)`, markup: '<wd-popup v-model="modelValue" position="bottom"><view class="popup-content">Popup content</view></wd-popup>' },
  'wd-resize': { markup: '<wd-resize><view class="resize-content">Resize target</view></wd-resize>' },
  'wd-root-portal': { markup: '<wd-root-portal><view class="portal-content">Portal content</view></wd-root-portal>' },
  'wd-signature': { markup: '<wd-signature />' },
  'wd-skeleton': { markup: '<wd-skeleton />' },
  'wd-slide-verify': { markup: '<wd-slide-verify />' },
  'wd-sort-button': { setup: `const modelValue = ref(0)`, markup: '<wd-sort-button v-model="modelValue" title="Sort" />' },
  'wd-sticky': { markup: '<wd-sticky :offset-top="0"><view class="sticky-content">Sticky content</view></wd-sticky>' },
  'wd-sticky-box': { markup: '<wd-sticky-box><wd-sticky :offset-top="0"><view class="sticky-content">Sticky box content</view></wd-sticky></wd-sticky-box>' },
  'wd-swipe-action': { setup: `const modelValue = ref('close')`, markup: '<wd-swipe-action v-model="modelValue"><wd-cell title="Swipe row" /><template #right><wd-button type="error">Delete</wd-button></template></wd-swipe-action>' },
  'wd-toast': { markup: '<wd-toast />' },
  'wd-tooltip': { setup: BOOLEAN_MODEL_SETUP, markup: '<wd-tooltip v-model="modelValue" content="Tooltip content"><wd-button size="small">Tooltip</wd-button></wd-tooltip>' },
  'wd-tour': { setup: `const modelValue = ref(true)\nconst tourSteps = [{ element: '#e2e-tour-anchor', content: 'First step' }, { element: '#e2e-tour-anchor', content: 'Second step' }]`, markup: '<view><view id="e2e-tour-anchor" class="tour-anchor">Tour anchor</view><wd-tour v-model="modelValue" :steps="tourSteps" /></view>' },
  'wd-video-preview': { markup: '<wd-video-preview />' },
}

const interactions: Partial<Record<string, ComponentInteraction>> = {
  'wd-action-sheet': { type: 'command', method: 'select', args: [0, 'action'], event: 'select' },
  'wd-avatar': { type: 'command', method: 'handleClick', event: 'click' },
  'wd-backtop': { type: 'command', method: 'handleBacktop' },
  'wd-button': { type: 'command', method: 'handleClick', event: 'click' },
  'wd-calendar': { type: 'command', method: 'open', event: 'open' },
  'wd-calendar-view': { type: 'command', method: 'scrollIntoView' },
  'wd-cascader': { type: 'command', method: 'close' },
  'wd-cell': { type: 'command', method: 'onClick', event: 'click' },
  'wd-checkbox': { type: 'command', method: 'toggle', event: 'change' },
  'wd-checkbox-group': { type: 'command', method: 'toggleAll', args: [false], event: 'change' },
  'wd-collapse': { type: 'command', method: 'toggleAll', args: [false], event: 'change' },
  'wd-collapse-item': { type: 'command', method: 'updateExpand', args: [false], expectTarget: { method: 'getExpanded', value: true } },
  'wd-count-down': { type: 'command', method: 'start' },
  'wd-count-to': { type: 'command', method: 'start' },
  'wd-curtain': { type: 'command', method: 'clickImage', event: 'click' },
  'wd-datetime-picker': { type: 'command', method: 'open', event: 'open' },
  'wd-datetime-picker-view': { type: 'command', method: 'getSelectedOptions' },
  'wd-dialog': { type: 'command', method: 'reset' },
  'wd-drop-menu': { type: 'command', method: 'toggle', args: [0] },
  'wd-drop-menu-item': { type: 'command', method: 'open', expectTarget: { method: 'getShowPop', value: true } },
  'wd-fab': { type: 'command', method: 'open', event: 'update:active' },
  'wd-floating-panel': { type: 'command', method: 'updateHeight', args: [160], event: 'update:height' },
  'wd-form': { type: 'command', method: 'validate' },
  'wd-form-item': { type: 'command', method: 'validateByTrigger', args: ['change'] },
  'wd-grid-item': { type: 'command', method: 'click', event: 'click' },
  'wd-icon': { type: 'command', method: 'handleClick', event: 'click' },
  'wd-image-preview': { type: 'command', method: 'open', delayAfter: 1000, args: [['/assets/sample.png', '/assets/sample-alt.png']], event: 'open' },
  'wd-img': { type: 'command', method: 'handleClick', event: 'click' },
  'wd-img-cropper': { type: 'command', method: 'resetImg' },
  'wd-index-bar': { type: 'command', method: 'init' },
  'wd-input': { type: 'command', method: 'handleClear', event: 'clear' },
  'wd-input-number': { type: 'command', method: 'handleClick', args: ['add'], event: 'change' },
  'wd-keyboard': { type: 'command', method: 'handleClose', event: 'close' },
  'wd-loadmore': { type: 'command', method: 'reload', event: 'reload' },
  'wd-navbar': { type: 'command', method: 'handleClickLeft', event: 'click-left' },
  'wd-navbar-capsule': { type: 'command', method: 'handleBack', event: 'back' },
  'wd-notice-bar': { type: 'command', method: 'reset' },
  'wd-notify': { type: 'command', method: 'onClick', event: 'click' },
  'wd-overlay': { type: 'command', method: 'handleClick', event: 'click' },
  'wd-pagination': { type: 'command', method: 'add', event: 'change' },
  'wd-password-input': { type: 'command', method: 'onTouchStart', event: 'focus' },
  'wd-picker': { type: 'command', method: 'open', event: 'open' },
  'wd-picker-view': { type: 'command', method: 'getSelectedValues' },
  'wd-popover': { type: 'command', method: 'open', event: 'open' },
  'wd-popup': { type: 'command', method: 'close', event: 'close' },
  'wd-radio': { type: 'command', method: 'handleClick', expect: { binding: 'modelValue', value: 'option-a' } },
  'wd-radio-group': { type: 'command', method: 'updateValue', args: ['option-b'], event: 'change' },
  'wd-rate': { type: 'command', method: 'updateValue', args: [3], event: 'change' },
  'wd-resize': { type: 'command', method: 'scrollToBottom', args: [{ lastWidth: 120, lastHeight: 80 }] },
  'wd-search': { type: 'command', method: 'handleClear', event: 'clear' },
  'wd-segmented': { type: 'command', method: 'updateActiveStyle', args: [false] },
  'wd-select-picker': { type: 'command', method: 'open', event: 'open' },
  'wd-sidebar': { type: 'command', method: 'updateValue', args: [1, 'Second'], event: 'change' },
  'wd-sidebar-item': { type: 'command', method: 'handleClick' },
  'wd-signature': { type: 'command', method: 'clear', event: 'clear' },
  'wd-slide-verify': { type: 'command', method: 'reset' },
  'wd-slider': { type: 'command', method: 'initSlider' },
  'wd-sort-button': { type: 'command', method: 'handleClick', event: 'change' },
  'wd-sticky': { type: 'command', method: 'setPosition', args: [true, 'fixed', 16] },
  'wd-swipe-action': { type: 'command', method: 'close' },
  'wd-swiper': { type: 'command', method: 'navTo', args: [1], expect: { binding: 'modelValue', value: 1 } },
  'wd-swiper-nav': { type: 'command', method: 'handleNav', args: ['next'], event: 'change' },
  'wd-switch': { type: 'command', method: 'switchValue', event: 'change' },
  'wd-tabbar': { type: 'command', method: 'setChange', args: [{ name: 1 }], event: 'change' },
  'wd-tabbar-item': { type: 'command', method: 'handleClick' },
  'wd-table': { type: 'command', method: 'rowClick', args: [0], event: 'row-click' },
  'wd-table-column': { type: 'command', method: 'rowClick', commandTarget: 'parent', args: [0], event: 'row-click', eventTarget: 'parent' },
  'wd-tabs': { type: 'command', method: 'setActive', delayBefore: 300, args: ['second', false, true], event: 'change', expect: { binding: 'modelValue', value: 'second' } },
  'wd-tag': { type: 'command', method: 'handleClick', event: 'click' },
  'wd-text': { type: 'command', method: 'handleClick', event: 'click' },
  'wd-textarea': { type: 'command', method: 'handleClear', event: 'clear' },
  'wd-toast': { type: 'command', method: 'reset', args: [{ show: true, msg: 'Stable toast', duration: 0 }] },
  'wd-tooltip': { type: 'command', method: 'open', event: 'open' },
  'wd-tour': { type: 'command', method: 'handleNext' },
  'wd-transition': { type: 'command', method: 'handleClick', event: 'click' },
  'wd-upload': { type: 'command', method: 'abort' },
  'wd-video-preview': { type: 'command', method: 'open', args: [{ url: '/assets/sample.mp4', poster: '/assets/sample.png', title: 'Local video', fullScreen: false }], event: 'open' },
}

export function getComponentMarkup(component: string): ComponentMarkup {
  const markup = overrides[component]
  if (!markup) {
    throw new Error(`缺少 Wot UI 组件场景: ${component}`)
  }
  return {
    ...markup,
    interaction: interactions[component],
  }
}
