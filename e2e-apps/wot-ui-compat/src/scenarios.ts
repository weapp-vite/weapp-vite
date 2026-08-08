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
  { component: 'wd-action-sheet', route: '/pages/components/wd-action-sheet/index', parent: null, capability: 'command', action: { type: 'command', method: 'select', args: [0, 'action'], event: 'select' }, expectedState: 'pass:command:select' },
  { component: 'wd-avatar', route: '/pages/components/wd-avatar/index', parent: null, capability: 'command', action: { type: 'command', method: 'handleClick', event: 'click' }, expectedState: 'pass:command:handleClick' },
  { component: 'wd-avatar-group', route: '/pages/components/wd-avatar-group/index', parent: 'wd-avatar-group', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-backtop', route: '/pages/components/wd-backtop/index', parent: null, capability: 'command', action: { type: 'command', method: 'handleBacktop' }, expectedState: 'pass:command:handleBacktop' },
  { component: 'wd-badge', route: '/pages/components/wd-badge/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-button', route: '/pages/components/wd-button/index', parent: null, capability: 'command', action: { type: 'command', method: 'handleClick', event: 'click' }, expectedState: 'pass:command:handleClick' },
  { component: 'wd-calendar', route: '/pages/components/wd-calendar/index', parent: null, capability: 'command', action: { type: 'command', method: 'open', event: 'open' }, expectedState: 'pass:command:open' },
  { component: 'wd-calendar-view', route: '/pages/components/wd-calendar-view/index', parent: null, capability: 'command', action: { type: 'command', method: 'scrollIntoView' }, expectedState: 'pass:command:scrollIntoView' },
  { component: 'wd-card', route: '/pages/components/wd-card/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-cascader', route: '/pages/components/wd-cascader/index', parent: null, capability: 'command', action: { type: 'command', method: 'close' }, expectedState: 'pass:command:close' },
  { component: 'wd-cell', route: '/pages/components/wd-cell/index', parent: null, capability: 'command', action: { type: 'command', method: 'onClick', event: 'click' }, expectedState: 'pass:command:onClick' },
  { component: 'wd-cell-group', route: '/pages/components/wd-cell-group/index', parent: 'wd-cell-group', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-checkbox', route: '/pages/components/wd-checkbox/index', parent: null, capability: 'command', action: { type: 'command', method: 'toggle', event: 'change' }, expectedState: 'pass:command:toggle' },
  { component: 'wd-checkbox-group', route: '/pages/components/wd-checkbox-group/index', parent: 'wd-checkbox-group', capability: 'command', action: { type: 'command', method: 'toggleAll', args: [false], event: 'change' }, expectedState: 'pass:command:toggleAll' },
  { component: 'wd-circle', route: '/pages/components/wd-circle/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-col', route: '/pages/components/wd-col/index', parent: 'wd-row', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-collapse', route: '/pages/components/wd-collapse/index', parent: 'wd-collapse', capability: 'command', action: { type: 'command', method: 'toggleAll', args: [false], event: 'change' }, expectedState: 'pass:command:toggleAll' },
  { component: 'wd-collapse-item', route: '/pages/components/wd-collapse-item/index', parent: 'wd-collapse', capability: 'command', action: { type: 'command', method: 'updateExpand', args: [false], expectTarget: { method: 'getExpanded', value: true } }, expectedState: 'pass:command:updateExpand' },
  { component: 'wd-config-provider', route: '/pages/components/wd-config-provider/index', parent: 'wd-config-provider', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-count-down', route: '/pages/components/wd-count-down/index', parent: null, capability: 'command', action: { type: 'command', method: 'start' }, expectedState: 'pass:command:start' },
  { component: 'wd-count-to', route: '/pages/components/wd-count-to/index', parent: null, capability: 'command', action: { type: 'command', method: 'start' }, expectedState: 'pass:command:start' },
  { component: 'wd-curtain', route: '/pages/components/wd-curtain/index', parent: null, capability: 'command', action: { type: 'command', method: 'clickImage', event: 'click' }, expectedState: 'pass:command:clickImage' },
  { component: 'wd-datetime-picker', route: '/pages/components/wd-datetime-picker/index', parent: null, capability: 'command', action: { type: 'command', method: 'open', event: 'open' }, expectedState: 'pass:command:open' },
  { component: 'wd-datetime-picker-view', route: '/pages/components/wd-datetime-picker-view/index', parent: null, capability: 'command', action: { type: 'command', method: 'getSelectedOptions' }, expectedState: 'pass:command:getSelectedOptions' },
  { component: 'wd-dialog', route: '/pages/components/wd-dialog/index', parent: null, capability: 'command', action: { type: 'command', method: 'reset' }, expectedState: 'pass:command:reset' },
  { component: 'wd-divider', route: '/pages/components/wd-divider/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-drop-menu', route: '/pages/components/wd-drop-menu/index', parent: 'wd-drop-menu', capability: 'command', action: { type: 'command', method: 'toggle', args: [0] }, expectedState: 'pass:command:toggle' },
  { component: 'wd-drop-menu-item', route: '/pages/components/wd-drop-menu-item/index', parent: 'wd-drop-menu', capability: 'command', action: { type: 'command', method: 'open', expectTarget: { method: 'getShowPop', value: true } }, expectedState: 'pass:command:open' },
  { component: 'wd-empty', route: '/pages/components/wd-empty/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-fab', route: '/pages/components/wd-fab/index', parent: null, capability: 'command', action: { type: 'command', method: 'open', event: 'update:active' }, expectedState: 'pass:command:open' },
  { component: 'wd-floating-panel', route: '/pages/components/wd-floating-panel/index', parent: null, capability: 'command', action: { type: 'command', method: 'updateHeight', args: [160], event: 'update:height' }, expectedState: 'pass:command:updateHeight' },
  { component: 'wd-form', route: '/pages/components/wd-form/index', parent: 'wd-form', capability: 'command', action: { type: 'command', method: 'validate' }, expectedState: 'pass:command:validate' },
  { component: 'wd-form-item', route: '/pages/components/wd-form-item/index', parent: 'wd-form', capability: 'command', action: { type: 'command', method: 'validateByTrigger', args: ['change'] }, expectedState: 'pass:command:validateByTrigger' },
  { component: 'wd-gap', route: '/pages/components/wd-gap/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-grid', route: '/pages/components/wd-grid/index', parent: 'wd-grid', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-grid-item', route: '/pages/components/wd-grid-item/index', parent: 'wd-grid', capability: 'command', action: { type: 'command', method: 'click', event: 'click' }, expectedState: 'pass:command:click' },
  { component: 'wd-icon', route: '/pages/components/wd-icon/index', parent: null, capability: 'command', action: { type: 'command', method: 'handleClick', event: 'click' }, expectedState: 'pass:command:handleClick' },
  { component: 'wd-image-preview', route: '/pages/components/wd-image-preview/index', parent: null, capability: 'command', action: { type: 'command', method: 'open', delayAfter: 1000, args: [['/assets/sample.png', '/assets/sample-alt.png']], event: 'open' }, expectedState: 'pass:command:open' },
  { component: 'wd-img', route: '/pages/components/wd-img/index', parent: null, capability: 'command', action: { type: 'command', method: 'handleClick', event: 'click' }, expectedState: 'pass:command:handleClick' },
  { component: 'wd-img-cropper', route: '/pages/components/wd-img-cropper/index', parent: null, capability: 'command', action: { type: 'command', method: 'resetImg' }, expectedState: 'pass:command:resetImg' },
  { component: 'wd-index-anchor', route: '/pages/components/wd-index-anchor/index', parent: 'wd-index-bar', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-index-bar', route: '/pages/components/wd-index-bar/index', parent: 'wd-index-bar', capability: 'command', action: { type: 'command', method: 'init' }, expectedState: 'pass:command:init' },
  { component: 'wd-input', route: '/pages/components/wd-input/index', parent: null, capability: 'command', action: { type: 'command', method: 'handleClear', event: 'clear' }, expectedState: 'pass:command:handleClear' },
  { component: 'wd-input-number', route: '/pages/components/wd-input-number/index', parent: null, capability: 'command', action: { type: 'command', method: 'handleClick', args: ['add'], event: 'change' }, expectedState: 'pass:command:handleClick' },
  { component: 'wd-keyboard', route: '/pages/components/wd-keyboard/index', parent: null, capability: 'command', action: { type: 'command', method: 'handleClose', event: 'close' }, expectedState: 'pass:command:handleClose' },
  { component: 'wd-loading', route: '/pages/components/wd-loading/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-loadmore', route: '/pages/components/wd-loadmore/index', parent: null, capability: 'command', action: { type: 'command', method: 'reload', event: 'reload' }, expectedState: 'pass:command:reload' },
  { component: 'wd-navbar', route: '/pages/components/wd-navbar/index', parent: null, capability: 'command', action: { type: 'command', method: 'handleClickLeft', event: 'click-left' }, expectedState: 'pass:command:handleClickLeft' },
  { component: 'wd-navbar-capsule', route: '/pages/components/wd-navbar-capsule/index', parent: null, capability: 'command', action: { type: 'command', method: 'handleBack', event: 'back' }, expectedState: 'pass:command:handleBack' },
  { component: 'wd-notice-bar', route: '/pages/components/wd-notice-bar/index', parent: null, capability: 'command', action: { type: 'command', method: 'reset' }, expectedState: 'pass:command:reset' },
  { component: 'wd-notify', route: '/pages/components/wd-notify/index', parent: null, capability: 'command', action: { type: 'command', method: 'onClick', event: 'click' }, expectedState: 'pass:command:onClick' },
  { component: 'wd-overlay', route: '/pages/components/wd-overlay/index', parent: null, capability: 'command', action: { type: 'command', method: 'handleClick', event: 'click' }, expectedState: 'pass:command:handleClick' },
  { component: 'wd-pagination', route: '/pages/components/wd-pagination/index', parent: null, capability: 'command', action: { type: 'command', method: 'add', event: 'change' }, expectedState: 'pass:command:add' },
  { component: 'wd-password-input', route: '/pages/components/wd-password-input/index', parent: null, capability: 'command', action: { type: 'command', method: 'onTouchStart', event: 'focus' }, expectedState: 'pass:command:onTouchStart' },
  { component: 'wd-picker', route: '/pages/components/wd-picker/index', parent: null, capability: 'command', action: { type: 'command', method: 'open', event: 'open' }, expectedState: 'pass:command:open' },
  { component: 'wd-picker-view', route: '/pages/components/wd-picker-view/index', parent: null, capability: 'command', action: { type: 'command', method: 'getSelectedValues' }, expectedState: 'pass:command:getSelectedValues' },
  { component: 'wd-popover', route: '/pages/components/wd-popover/index', parent: null, capability: 'command', action: { type: 'command', method: 'open', event: 'open' }, expectedState: 'pass:command:open' },
  { component: 'wd-popup', route: '/pages/components/wd-popup/index', parent: null, capability: 'command', action: { type: 'command', method: 'close', event: 'close' }, expectedState: 'pass:command:close' },
  { component: 'wd-progress', route: '/pages/components/wd-progress/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-radio', route: '/pages/components/wd-radio/index', parent: 'wd-radio-group', capability: 'command', action: { type: 'command', method: 'handleClick', expect: { binding: 'modelValue', value: 'option-a' } }, expectedState: 'pass:command:handleClick' },
  { component: 'wd-radio-group', route: '/pages/components/wd-radio-group/index', parent: 'wd-radio-group', capability: 'command', action: { type: 'command', method: 'updateValue', args: ['option-b'], event: 'change' }, expectedState: 'pass:command:updateValue' },
  { component: 'wd-rate', route: '/pages/components/wd-rate/index', parent: null, capability: 'command', action: { type: 'command', method: 'updateValue', args: [3], event: 'change' }, expectedState: 'pass:command:updateValue' },
  { component: 'wd-resize', route: '/pages/components/wd-resize/index', parent: null, capability: 'command', action: { type: 'command', method: 'scrollToBottom', args: [{ lastWidth: 120, lastHeight: 80 }] }, expectedState: 'pass:command:scrollToBottom' },
  { component: 'wd-root-portal', route: '/pages/components/wd-root-portal/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-row', route: '/pages/components/wd-row/index', parent: 'wd-row', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-search', route: '/pages/components/wd-search/index', parent: null, capability: 'command', action: { type: 'command', method: 'handleClear', event: 'clear' }, expectedState: 'pass:command:handleClear' },
  { component: 'wd-segmented', route: '/pages/components/wd-segmented/index', parent: null, capability: 'command', action: { type: 'command', method: 'updateActiveStyle', args: [false] }, expectedState: 'pass:command:updateActiveStyle' },
  { component: 'wd-select-picker', route: '/pages/components/wd-select-picker/index', parent: null, capability: 'command', action: { type: 'command', method: 'open', event: 'open' }, expectedState: 'pass:command:open' },
  { component: 'wd-sidebar', route: '/pages/components/wd-sidebar/index', parent: 'wd-sidebar', capability: 'command', action: { type: 'command', method: 'updateValue', args: [1, 'Second'], event: 'change' }, expectedState: 'pass:command:updateValue' },
  { component: 'wd-sidebar-item', route: '/pages/components/wd-sidebar-item/index', parent: 'wd-sidebar', capability: 'command', action: { type: 'command', method: 'handleClick' }, expectedState: 'pass:command:handleClick' },
  { component: 'wd-signature', route: '/pages/components/wd-signature/index', parent: null, capability: 'command', action: { type: 'command', method: 'clear', event: 'clear' }, expectedState: 'pass:command:clear' },
  { component: 'wd-skeleton', route: '/pages/components/wd-skeleton/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-slide-verify', route: '/pages/components/wd-slide-verify/index', parent: null, capability: 'command', action: { type: 'command', method: 'reset' }, expectedState: 'pass:command:reset' },
  { component: 'wd-slider', route: '/pages/components/wd-slider/index', parent: null, capability: 'command', action: { type: 'command', method: 'initSlider' }, expectedState: 'pass:command:initSlider' },
  { component: 'wd-sort-button', route: '/pages/components/wd-sort-button/index', parent: null, capability: 'command', action: { type: 'command', method: 'handleClick', event: 'change' }, expectedState: 'pass:command:handleClick' },
  { component: 'wd-step', route: '/pages/components/wd-step/index', parent: 'wd-steps', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-steps', route: '/pages/components/wd-steps/index', parent: 'wd-steps', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-sticky', route: '/pages/components/wd-sticky/index', parent: null, capability: 'command', action: { type: 'command', method: 'setPosition', args: [true, 'fixed', 16] }, expectedState: 'pass:command:setPosition' },
  { component: 'wd-sticky-box', route: '/pages/components/wd-sticky-box/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-swipe-action', route: '/pages/components/wd-swipe-action/index', parent: null, capability: 'command', action: { type: 'command', method: 'close' }, expectedState: 'pass:command:close' },
  { component: 'wd-swiper', route: '/pages/components/wd-swiper/index', parent: 'wd-swiper', capability: 'command', action: { type: 'command', method: 'navTo', args: [1], expect: { binding: 'modelValue', value: 1 } }, expectedState: 'pass:command:navTo' },
  { component: 'wd-swiper-nav', route: '/pages/components/wd-swiper-nav/index', parent: 'wd-swiper', capability: 'command', action: { type: 'command', method: 'handleNav', args: ['next'], event: 'change' }, expectedState: 'pass:command:handleNav' },
  { component: 'wd-switch', route: '/pages/components/wd-switch/index', parent: null, capability: 'command', action: { type: 'command', method: 'switchValue', event: 'change' }, expectedState: 'pass:command:switchValue' },
  { component: 'wd-tab', route: '/pages/components/wd-tab/index', parent: 'wd-tabs', capability: 'render', action: null, expectedState: 'pass:render' },
  { component: 'wd-tabbar', route: '/pages/components/wd-tabbar/index', parent: 'wd-tabbar', capability: 'command', action: { type: 'command', method: 'setChange', args: [{ name: 1 }], event: 'change' }, expectedState: 'pass:command:setChange' },
  { component: 'wd-tabbar-item', route: '/pages/components/wd-tabbar-item/index', parent: 'wd-tabbar', capability: 'command', action: { type: 'command', method: 'handleClick' }, expectedState: 'pass:command:handleClick' },
  { component: 'wd-table', route: '/pages/components/wd-table/index', parent: 'wd-table', capability: 'command', action: { type: 'command', method: 'rowClick', args: [0], event: 'row-click' }, expectedState: 'pass:command:rowClick' },
  { component: 'wd-table-column', route: '/pages/components/wd-table-column/index', parent: 'wd-table', capability: 'command', action: { type: 'command', method: 'rowClick', commandTarget: 'parent', args: [0], event: 'row-click', eventTarget: 'parent' }, expectedState: 'pass:command:rowClick' },
  { component: 'wd-tabs', route: '/pages/components/wd-tabs/index', parent: 'wd-tabs', capability: 'command', action: { type: 'command', method: 'setActive', delayBefore: 300, args: ['second', false, true], event: 'change', expect: { binding: 'modelValue', value: 'second' } }, expectedState: 'pass:command:setActive' },
  { component: 'wd-tag', route: '/pages/components/wd-tag/index', parent: null, capability: 'command', action: { type: 'command', method: 'handleClick', event: 'click' }, expectedState: 'pass:command:handleClick' },
  { component: 'wd-text', route: '/pages/components/wd-text/index', parent: null, capability: 'command', action: { type: 'command', method: 'handleClick', event: 'click' }, expectedState: 'pass:command:handleClick' },
  { component: 'wd-textarea', route: '/pages/components/wd-textarea/index', parent: null, capability: 'command', action: { type: 'command', method: 'handleClear', event: 'clear' }, expectedState: 'pass:command:handleClear' },
  { component: 'wd-toast', route: '/pages/components/wd-toast/index', parent: null, capability: 'command', action: { type: 'command', method: 'reset', args: [{ show: true, msg: 'Stable toast', duration: 0 }] }, expectedState: 'pass:command:reset' },
  { component: 'wd-tooltip', route: '/pages/components/wd-tooltip/index', parent: null, capability: 'command', action: { type: 'command', method: 'open', event: 'open' }, expectedState: 'pass:command:open' },
  { component: 'wd-tour', route: '/pages/components/wd-tour/index', parent: null, capability: 'command', action: { type: 'command', method: 'handleNext' }, expectedState: 'pass:command:handleNext' },
  { component: 'wd-transition', route: '/pages/components/wd-transition/index', parent: null, capability: 'command', action: { type: 'command', method: 'handleClick', event: 'click' }, expectedState: 'pass:command:handleClick' },
  { component: 'wd-upload', route: '/pages/components/wd-upload/index', parent: null, capability: 'command', action: { type: 'command', method: 'abort' }, expectedState: 'pass:command:abort' },
  { component: 'wd-video-preview', route: '/pages/components/wd-video-preview/index', parent: null, capability: 'command', action: { type: 'command', method: 'open', args: [{ url: '/assets/sample.mp4', poster: '/assets/sample.png', title: 'Local video', fullScreen: false }], event: 'open' }, expectedState: 'pass:command:open' },
  { component: 'wd-watermark', route: '/pages/components/wd-watermark/index', parent: null, capability: 'render', action: null, expectedState: 'pass:render' },
] as const satisfies readonly ComponentScenario[]
