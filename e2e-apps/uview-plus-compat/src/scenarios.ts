export type ComponentScenarioAction = {
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

export interface ComponentScenario {
  component: string
  route: string
  parent: string | null
  capability: 'render' | 'command' | 'model'
  action: ComponentScenarioAction | null
  expectedState: string
}

export const componentScenarios = [
  { component: 'up-action-sheet', route: '/pages/components/up-action-sheet/index', parent: 'up-action-sheet', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-agreement', route: '/pages/components/up-agreement/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-album', route: '/pages/components/up-album/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-alert', route: '/pages/components/up-alert/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-avatar', route: '/pages/components/up-avatar/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-avatar-group', route: '/pages/components/up-avatar-group/index', parent: 'up-avatar-group', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-back-top', route: '/pages/components/up-back-top/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-badge', route: '/pages/components/up-badge/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-barcode', route: '/pages/components/up-barcode/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-box', route: '/pages/components/up-box/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-button', route: '/pages/components/up-button/index', parent: null, capability: 'command', action: { type: 'command', method: 'clickHandler', event: 'click' }, expectedState: 'pass:command:clickHandler' },
  { component: 'up-calendar', route: '/pages/components/up-calendar/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-calendar-strip', route: '/pages/components/up-calendar-strip/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-canvas', route: '/pages/components/up-canvas/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-car-keyboard', route: '/pages/components/up-car-keyboard/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-card', route: '/pages/components/up-card/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-cascader', route: '/pages/components/up-cascader/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-cate-tab', route: '/pages/components/up-cate-tab/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-cell', route: '/pages/components/up-cell/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-cell-group', route: '/pages/components/up-cell-group/index', parent: 'up-cell-group', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-checkbox', route: '/pages/components/up-checkbox/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-checkbox-group', route: '/pages/components/up-checkbox-group/index', parent: 'up-checkbox-group', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-choose', route: '/pages/components/up-choose/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-circle-progress', route: '/pages/components/up-circle-progress/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-city-locate', route: '/pages/components/up-city-locate/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-code', route: '/pages/components/up-code/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-code-input', route: '/pages/components/up-code-input/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-col', route: '/pages/components/up-col/index', parent: 'up-row', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-collapse', route: '/pages/components/up-collapse/index', parent: 'up-collapse', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-collapse-item', route: '/pages/components/up-collapse-item/index', parent: 'up-collapse', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-color-picker', route: '/pages/components/up-color-picker/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-copy', route: '/pages/components/up-copy/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-count-down', route: '/pages/components/up-count-down/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-count-to', route: '/pages/components/up-count-to/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-coupon', route: '/pages/components/up-coupon/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-cropper', route: '/pages/components/up-cropper/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-datetime-picker', route: '/pages/components/up-datetime-picker/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-divider', route: '/pages/components/up-divider/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-dragsort', route: '/pages/components/up-dragsort/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-dropdown', route: '/pages/components/up-dropdown/index', parent: 'up-dropdown', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-dropdown-item', route: '/pages/components/up-dropdown-item/index', parent: 'up-dropdown', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-empty', route: '/pages/components/up-empty/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-float-button', route: '/pages/components/up-float-button/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-form', route: '/pages/components/up-form/index', parent: 'up-form', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-form-item', route: '/pages/components/up-form-item/index', parent: 'up-form', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-gap', route: '/pages/components/up-gap/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-goods-sku', route: '/pages/components/up-goods-sku/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-grid', route: '/pages/components/up-grid/index', parent: 'up-grid', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-grid-item', route: '/pages/components/up-grid-item/index', parent: 'up-grid', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-guide', route: '/pages/components/up-guide/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-icon', route: '/pages/components/up-icon/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-image', route: '/pages/components/up-image/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-index-anchor', route: '/pages/components/up-index-anchor/index', parent: 'up-index-list', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-index-item', route: '/pages/components/up-index-item/index', parent: 'up-index-list', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-index-list', route: '/pages/components/up-index-list/index', parent: 'up-index-list', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-input', route: '/pages/components/up-input/index', parent: null, capability: 'model', action: { type: 'model', model: 'modelValue', value: 'Changed' }, expectedState: 'pass:model:modelValue' },
  { component: 'up-keyboard', route: '/pages/components/up-keyboard/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-lazy-load', route: '/pages/components/up-lazy-load/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-line', route: '/pages/components/up-line/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-line-progress', route: '/pages/components/up-line-progress/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-link', route: '/pages/components/up-link/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-list', route: '/pages/components/up-list/index', parent: 'up-list', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-list-item', route: '/pages/components/up-list-item/index', parent: 'up-list', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-loading-icon', route: '/pages/components/up-loading-icon/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-loading-page', route: '/pages/components/up-loading-page/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-loadmore', route: '/pages/components/up-loadmore/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-markdown', route: '/pages/components/up-markdown/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-message-input', route: '/pages/components/up-message-input/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-modal', route: '/pages/components/up-modal/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-navbar', route: '/pages/components/up-navbar/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-navbar-mini', route: '/pages/components/up-navbar-mini/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-no-network', route: '/pages/components/up-no-network/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-notice-bar', route: '/pages/components/up-notice-bar/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-notify', route: '/pages/components/up-notify/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-novel-reader', route: '/pages/components/up-novel-reader/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-number-box', route: '/pages/components/up-number-box/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-number-keyboard', route: '/pages/components/up-number-keyboard/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-overlay', route: '/pages/components/up-overlay/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-pagination', route: '/pages/components/up-pagination/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-parse', route: '/pages/components/up-parse/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-pdf-reader', route: '/pages/components/up-pdf-reader/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-picker', route: '/pages/components/up-picker/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-picker-column', route: '/pages/components/up-picker-column/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-picker-data', route: '/pages/components/up-picker-data/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-popover', route: '/pages/components/up-popover/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-popup', route: '/pages/components/up-popup/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-poster', route: '/pages/components/up-poster/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-pull-refresh', route: '/pages/components/up-pull-refresh/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-qrcode', route: '/pages/components/up-qrcode/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-radio', route: '/pages/components/up-radio/index', parent: 'up-radio-group', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-radio-group', route: '/pages/components/up-radio-group/index', parent: 'up-radio-group', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-rate', route: '/pages/components/up-rate/index', parent: null, capability: 'model', action: { type: 'model', model: 'modelValue', value: 3 }, expectedState: 'pass:model:modelValue' },
  { component: 'up-read-more', route: '/pages/components/up-read-more/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-refresh-virtual-list', route: '/pages/components/up-refresh-virtual-list/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-row', route: '/pages/components/up-row/index', parent: 'up-row', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-row-notice', route: '/pages/components/up-row-notice/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-safe-bottom', route: '/pages/components/up-safe-bottom/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-scroll-list', route: '/pages/components/up-scroll-list/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-search', route: '/pages/components/up-search/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-select', route: '/pages/components/up-select/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-short-video', route: '/pages/components/up-short-video/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-signature', route: '/pages/components/up-signature/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-skeleton', route: '/pages/components/up-skeleton/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-slider', route: '/pages/components/up-slider/index', parent: null, capability: 'model', action: { type: 'model', model: 'modelValue', value: 60 }, expectedState: 'pass:model:modelValue' },
  { component: 'up-status-bar', route: '/pages/components/up-status-bar/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-steps', route: '/pages/components/up-steps/index', parent: 'up-steps', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-steps-item', route: '/pages/components/up-steps-item/index', parent: 'up-steps', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-sticky', route: '/pages/components/up-sticky/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-subsection', route: '/pages/components/up-subsection/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-swipe-action', route: '/pages/components/up-swipe-action/index', parent: 'up-swipe-action', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-swipe-action-item', route: '/pages/components/up-swipe-action-item/index', parent: 'up-swipe-action', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-swiper', route: '/pages/components/up-swiper/index', parent: 'up-swiper', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-swiper-indicator', route: '/pages/components/up-swiper-indicator/index', parent: 'up-swiper', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-switch', route: '/pages/components/up-switch/index', parent: null, capability: 'model', action: { type: 'model', model: 'modelValue', value: true }, expectedState: 'pass:model:modelValue' },
  { component: 'up-tabbar', route: '/pages/components/up-tabbar/index', parent: 'up-tabbar', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-tabbar-item', route: '/pages/components/up-tabbar-item/index', parent: 'up-tabbar', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-table', route: '/pages/components/up-table/index', parent: 'up-table', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-table2', route: '/pages/components/up-table2/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-tabs', route: '/pages/components/up-tabs/index', parent: 'up-tabs', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-tabs-item', route: '/pages/components/up-tabs-item/index', parent: 'up-tabs', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-tabs-pro', route: '/pages/components/up-tabs-pro/index', parent: null, capability: 'model', action: { type: 'model', model: 'modelValue', value: 1 }, expectedState: 'pass:model:modelValue' },
  { component: 'up-tag', route: '/pages/components/up-tag/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-td', route: '/pages/components/up-td/index', parent: 'up-table', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-text', route: '/pages/components/up-text/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-textarea', route: '/pages/components/up-textarea/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-th', route: '/pages/components/up-th/index', parent: 'up-table', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-title', route: '/pages/components/up-title/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-toast', route: '/pages/components/up-toast/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-toolbar', route: '/pages/components/up-toolbar/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-tooltip', route: '/pages/components/up-tooltip/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-tr', route: '/pages/components/up-tr/index', parent: 'up-table', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-transition', route: '/pages/components/up-transition/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-tree', route: '/pages/components/up-tree/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-upload', route: '/pages/components/up-upload/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-view', route: '/pages/components/up-view/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-virtual-list', route: '/pages/components/up-virtual-list/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'up-waterfall', route: '/pages/components/up-waterfall/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
] as const satisfies readonly ComponentScenario[]
