/* eslint-disable */
// biome-ignore lint: disable
// oxlint-disable
// ------
// 由 weapp-vite autoImportComponents 生成
import type { ComponentOptionsMixin, DefineComponent, PublicProps } from 'wevu'
import type { ComponentProp } from 'weapp-vite/typed-components'

export {}

type WeappComponent<Props = Record<string, any>> = new (...args: any[]) => InstanceType<DefineComponent<{}, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}, string, PublicProps, Props, {}>>
type __WeappComponentImport<T, Fallback = {}> = 0 extends 1 & T ? Fallback : T

declare module 'vue' {
  export interface GlobalComponents {
    TActionSheet: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/action-sheet/action-sheet")> & WeappComponent<ComponentProp<"t-action-sheet">>;
    't-action-sheet': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/action-sheet/action-sheet")> & WeappComponent<ComponentProp<"t-action-sheet">>;
    TAvatar: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/avatar/avatar")> & WeappComponent<ComponentProp<"t-avatar">>;
    't-avatar': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/avatar/avatar")> & WeappComponent<ComponentProp<"t-avatar">>;
    TAvatarGroup: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/avatar-group/avatar-group")> & WeappComponent<ComponentProp<"t-avatar-group">>;
    't-avatar-group': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/avatar-group/avatar-group")> & WeappComponent<ComponentProp<"t-avatar-group">>;
    TBackTop: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/back-top/back-top")> & WeappComponent<ComponentProp<"t-back-top">>;
    't-back-top': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/back-top/back-top")> & WeappComponent<ComponentProp<"t-back-top">>;
    TBadge: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/badge/badge")> & WeappComponent<ComponentProp<"t-badge">>;
    't-badge': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/badge/badge")> & WeappComponent<ComponentProp<"t-badge">>;
    TButton: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/button/button")> & WeappComponent<ComponentProp<"t-button">>;
    't-button': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/button/button")> & WeappComponent<ComponentProp<"t-button">>;
    TCalendar: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/calendar/calendar")> & WeappComponent<ComponentProp<"t-calendar">>;
    't-calendar': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/calendar/calendar")> & WeappComponent<ComponentProp<"t-calendar">>;
    TCascader: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/cascader/cascader")> & WeappComponent<ComponentProp<"t-cascader">>;
    't-cascader': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/cascader/cascader")> & WeappComponent<ComponentProp<"t-cascader">>;
    TCell: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/cell/cell")> & WeappComponent<ComponentProp<"t-cell">>;
    't-cell': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/cell/cell")> & WeappComponent<ComponentProp<"t-cell">>;
    TCellGroup: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/cell-group/cell-group")> & WeappComponent<ComponentProp<"t-cell-group">>;
    't-cell-group': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/cell-group/cell-group")> & WeappComponent<ComponentProp<"t-cell-group">>;
    TCheckTag: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/check-tag/check-tag")> & WeappComponent<ComponentProp<"t-check-tag">>;
    't-check-tag': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/check-tag/check-tag")> & WeappComponent<ComponentProp<"t-check-tag">>;
    TCheckbox: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/checkbox/checkbox")> & WeappComponent<ComponentProp<"t-checkbox">>;
    't-checkbox': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/checkbox/checkbox")> & WeappComponent<ComponentProp<"t-checkbox">>;
    TCheckboxGroup: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/checkbox-group/checkbox-group")> & WeappComponent<ComponentProp<"t-checkbox-group">>;
    't-checkbox-group': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/checkbox-group/checkbox-group")> & WeappComponent<ComponentProp<"t-checkbox-group">>;
    TCol: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/col/col")> & WeappComponent<ComponentProp<"t-col">>;
    't-col': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/col/col")> & WeappComponent<ComponentProp<"t-col">>;
    TCollapse: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/collapse/collapse")> & WeappComponent<ComponentProp<"t-collapse">>;
    't-collapse': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/collapse/collapse")> & WeappComponent<ComponentProp<"t-collapse">>;
    TCollapsePanel: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/collapse-panel/collapse-panel")> & WeappComponent<ComponentProp<"t-collapse-panel">>;
    't-collapse-panel': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/collapse-panel/collapse-panel")> & WeappComponent<ComponentProp<"t-collapse-panel">>;
    TColorPicker: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/color-picker/color-picker")> & WeappComponent<ComponentProp<"t-color-picker">>;
    't-color-picker': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/color-picker/color-picker")> & WeappComponent<ComponentProp<"t-color-picker">>;
    TCountDown: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/count-down/count-down")> & WeappComponent<ComponentProp<"t-count-down">>;
    't-count-down': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/count-down/count-down")> & WeappComponent<ComponentProp<"t-count-down">>;
    TDateTimePicker: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/date-time-picker/date-time-picker")> & WeappComponent<ComponentProp<"t-date-time-picker">>;
    't-date-time-picker': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/date-time-picker/date-time-picker")> & WeappComponent<ComponentProp<"t-date-time-picker">>;
    TDialog: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/dialog/dialog")> & WeappComponent<ComponentProp<"t-dialog">>;
    't-dialog': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/dialog/dialog")> & WeappComponent<ComponentProp<"t-dialog">>;
    TDivider: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/divider/divider")> & WeappComponent<ComponentProp<"t-divider">>;
    't-divider': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/divider/divider")> & WeappComponent<ComponentProp<"t-divider">>;
    TDrawer: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/drawer/drawer")> & WeappComponent<ComponentProp<"t-drawer">>;
    't-drawer': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/drawer/drawer")> & WeappComponent<ComponentProp<"t-drawer">>;
    TDropdownItem: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/dropdown-item/dropdown-item")> & WeappComponent<ComponentProp<"t-dropdown-item">>;
    't-dropdown-item': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/dropdown-item/dropdown-item")> & WeappComponent<ComponentProp<"t-dropdown-item">>;
    TDropdownMenu: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/dropdown-menu/dropdown-menu")> & WeappComponent<ComponentProp<"t-dropdown-menu">>;
    't-dropdown-menu': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/dropdown-menu/dropdown-menu")> & WeappComponent<ComponentProp<"t-dropdown-menu">>;
    TEmpty: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/empty/empty")> & WeappComponent<ComponentProp<"t-empty">>;
    't-empty': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/empty/empty")> & WeappComponent<ComponentProp<"t-empty">>;
    TFab: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/fab/fab")> & WeappComponent<ComponentProp<"t-fab">>;
    't-fab': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/fab/fab")> & WeappComponent<ComponentProp<"t-fab">>;
    TFooter: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/footer/footer")> & WeappComponent<ComponentProp<"t-footer">>;
    't-footer': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/footer/footer")> & WeappComponent<ComponentProp<"t-footer">>;
    TForm: WeappComponent<ComponentProp<"t-form">>;
    't-form': WeappComponent<ComponentProp<"t-form">>;
    TFormItem: WeappComponent<ComponentProp<"t-form-item">>;
    't-form-item': WeappComponent<ComponentProp<"t-form-item">>;
    TGrid: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/grid/grid")> & WeappComponent<ComponentProp<"t-grid">>;
    't-grid': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/grid/grid")> & WeappComponent<ComponentProp<"t-grid">>;
    TGridItem: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/grid-item/grid-item")> & WeappComponent<ComponentProp<"t-grid-item">>;
    't-grid-item': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/grid-item/grid-item")> & WeappComponent<ComponentProp<"t-grid-item">>;
    TGuide: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/guide/guide")> & WeappComponent<ComponentProp<"t-guide">>;
    't-guide': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/guide/guide")> & WeappComponent<ComponentProp<"t-guide">>;
    TIcon: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/icon/icon")> & WeappComponent<ComponentProp<"t-icon">>;
    't-icon': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/icon/icon")> & WeappComponent<ComponentProp<"t-icon">>;
    TImage: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/image/image")> & WeappComponent<ComponentProp<"t-image">>;
    't-image': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/image/image")> & WeappComponent<ComponentProp<"t-image">>;
    TImageViewer: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/image-viewer/image-viewer")> & WeappComponent<ComponentProp<"t-image-viewer">>;
    't-image-viewer': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/image-viewer/image-viewer")> & WeappComponent<ComponentProp<"t-image-viewer">>;
    TIndexes: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/indexes/indexes")> & WeappComponent<ComponentProp<"t-indexes">>;
    't-indexes': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/indexes/indexes")> & WeappComponent<ComponentProp<"t-indexes">>;
    TIndexesAnchor: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/indexes-anchor/indexes-anchor")> & WeappComponent<ComponentProp<"t-indexes-anchor">>;
    't-indexes-anchor': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/indexes-anchor/indexes-anchor")> & WeappComponent<ComponentProp<"t-indexes-anchor">>;
    TInput: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/input/input")> & WeappComponent<ComponentProp<"t-input">>;
    't-input': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/input/input")> & WeappComponent<ComponentProp<"t-input">>;
    TLink: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/link/link")> & WeappComponent<ComponentProp<"t-link">>;
    't-link': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/link/link")> & WeappComponent<ComponentProp<"t-link">>;
    TLoading: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/loading/loading")> & WeappComponent<ComponentProp<"t-loading">>;
    't-loading': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/loading/loading")> & WeappComponent<ComponentProp<"t-loading">>;
    TMessage: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/message/message")> & WeappComponent<ComponentProp<"t-message">>;
    't-message': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/message/message")> & WeappComponent<ComponentProp<"t-message">>;
    TMessageItem: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/message-item/message-item")> & WeappComponent<ComponentProp<"t-message-item">>;
    't-message-item': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/message-item/message-item")> & WeappComponent<ComponentProp<"t-message-item">>;
    TNavbar: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/navbar/navbar")> & WeappComponent<ComponentProp<"t-navbar">>;
    't-navbar': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/navbar/navbar")> & WeappComponent<ComponentProp<"t-navbar">>;
    TNoticeBar: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/notice-bar/notice-bar")> & WeappComponent<ComponentProp<"t-notice-bar">>;
    't-notice-bar': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/notice-bar/notice-bar")> & WeappComponent<ComponentProp<"t-notice-bar">>;
    TOverlay: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/overlay/overlay")> & WeappComponent<ComponentProp<"t-overlay">>;
    't-overlay': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/overlay/overlay")> & WeappComponent<ComponentProp<"t-overlay">>;
    TPicker: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/picker/picker")> & WeappComponent<ComponentProp<"t-picker">>;
    't-picker': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/picker/picker")> & WeappComponent<ComponentProp<"t-picker">>;
    TPickerItem: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/picker-item/picker-item")> & WeappComponent<ComponentProp<"t-picker-item">>;
    't-picker-item': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/picker-item/picker-item")> & WeappComponent<ComponentProp<"t-picker-item">>;
    TPopup: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/popup/popup")> & WeappComponent<ComponentProp<"t-popup">>;
    't-popup': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/popup/popup")> & WeappComponent<ComponentProp<"t-popup">>;
    TProgress: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/progress/progress")> & WeappComponent<ComponentProp<"t-progress">>;
    't-progress': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/progress/progress")> & WeappComponent<ComponentProp<"t-progress">>;
    TPullDownRefresh: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/pull-down-refresh/pull-down-refresh")> & WeappComponent<ComponentProp<"t-pull-down-refresh">>;
    't-pull-down-refresh': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/pull-down-refresh/pull-down-refresh")> & WeappComponent<ComponentProp<"t-pull-down-refresh">>;
    TQrcode: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/qrcode/qrcode")> & WeappComponent<ComponentProp<"t-qrcode">>;
    't-qrcode': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/qrcode/qrcode")> & WeappComponent<ComponentProp<"t-qrcode">>;
    TRadio: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/radio/radio")> & WeappComponent<ComponentProp<"t-radio">>;
    't-radio': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/radio/radio")> & WeappComponent<ComponentProp<"t-radio">>;
    TRadioGroup: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/radio-group/radio-group")> & WeappComponent<ComponentProp<"t-radio-group">>;
    't-radio-group': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/radio-group/radio-group")> & WeappComponent<ComponentProp<"t-radio-group">>;
    TRate: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/rate/rate")> & WeappComponent<ComponentProp<"t-rate">>;
    't-rate': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/rate/rate")> & WeappComponent<ComponentProp<"t-rate">>;
    TResult: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/result/result")> & WeappComponent<ComponentProp<"t-result">>;
    't-result': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/result/result")> & WeappComponent<ComponentProp<"t-result">>;
    TRow: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/row/row")> & WeappComponent<ComponentProp<"t-row">>;
    't-row': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/row/row")> & WeappComponent<ComponentProp<"t-row">>;
    TScrollView: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/scroll-view/scroll-view")> & WeappComponent<ComponentProp<"t-scroll-view">>;
    't-scroll-view': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/scroll-view/scroll-view")> & WeappComponent<ComponentProp<"t-scroll-view">>;
    TSearch: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/search/search")> & WeappComponent<ComponentProp<"t-search">>;
    't-search': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/search/search")> & WeappComponent<ComponentProp<"t-search">>;
    TSideBar: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/side-bar/side-bar")> & WeappComponent<ComponentProp<"t-side-bar">>;
    't-side-bar': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/side-bar/side-bar")> & WeappComponent<ComponentProp<"t-side-bar">>;
    TSideBarItem: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/side-bar-item/side-bar-item")> & WeappComponent<ComponentProp<"t-side-bar-item">>;
    't-side-bar-item': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/side-bar-item/side-bar-item")> & WeappComponent<ComponentProp<"t-side-bar-item">>;
    TSkeleton: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/skeleton/skeleton")> & WeappComponent<ComponentProp<"t-skeleton">>;
    't-skeleton': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/skeleton/skeleton")> & WeappComponent<ComponentProp<"t-skeleton">>;
    TSlider: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/slider/slider")> & WeappComponent<ComponentProp<"t-slider">>;
    't-slider': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/slider/slider")> & WeappComponent<ComponentProp<"t-slider">>;
    TStepItem: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/step-item/step-item")> & WeappComponent<ComponentProp<"t-step-item">>;
    't-step-item': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/step-item/step-item")> & WeappComponent<ComponentProp<"t-step-item">>;
    TStepper: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/stepper/stepper")> & WeappComponent<ComponentProp<"t-stepper">>;
    't-stepper': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/stepper/stepper")> & WeappComponent<ComponentProp<"t-stepper">>;
    TSteps: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/steps/steps")> & WeappComponent<ComponentProp<"t-steps">>;
    't-steps': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/steps/steps")> & WeappComponent<ComponentProp<"t-steps">>;
    TSticky: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/sticky/sticky")> & WeappComponent<ComponentProp<"t-sticky">>;
    't-sticky': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/sticky/sticky")> & WeappComponent<ComponentProp<"t-sticky">>;
    TSwipeCell: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/swipe-cell/swipe-cell")> & WeappComponent<ComponentProp<"t-swipe-cell">>;
    't-swipe-cell': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/swipe-cell/swipe-cell")> & WeappComponent<ComponentProp<"t-swipe-cell">>;
    TSwiper: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/swiper/swiper")> & WeappComponent<ComponentProp<"t-swiper">>;
    't-swiper': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/swiper/swiper")> & WeappComponent<ComponentProp<"t-swiper">>;
    TSwiperNav: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/swiper-nav/swiper-nav")> & WeappComponent<ComponentProp<"t-swiper-nav">>;
    't-swiper-nav': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/swiper-nav/swiper-nav")> & WeappComponent<ComponentProp<"t-swiper-nav">>;
    TSwitch: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/switch/switch")> & WeappComponent<ComponentProp<"t-switch">>;
    't-switch': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/switch/switch")> & WeappComponent<ComponentProp<"t-switch">>;
    TTabBar: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/tab-bar/tab-bar")> & WeappComponent<ComponentProp<"t-tab-bar">>;
    't-tab-bar': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/tab-bar/tab-bar")> & WeappComponent<ComponentProp<"t-tab-bar">>;
    TTabBarItem: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/tab-bar-item/tab-bar-item")> & WeappComponent<ComponentProp<"t-tab-bar-item">>;
    't-tab-bar-item': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/tab-bar-item/tab-bar-item")> & WeappComponent<ComponentProp<"t-tab-bar-item">>;
    TTabPanel: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/tab-panel/tab-panel")> & WeappComponent<ComponentProp<"t-tab-panel">>;
    't-tab-panel': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/tab-panel/tab-panel")> & WeappComponent<ComponentProp<"t-tab-panel">>;
    TTabs: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/tabs/tabs")> & WeappComponent<ComponentProp<"t-tabs">>;
    't-tabs': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/tabs/tabs")> & WeappComponent<ComponentProp<"t-tabs">>;
    TTag: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/tag/tag")> & WeappComponent<ComponentProp<"t-tag">>;
    't-tag': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/tag/tag")> & WeappComponent<ComponentProp<"t-tag">>;
    TTextarea: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/textarea/textarea")> & WeappComponent<ComponentProp<"t-textarea">>;
    't-textarea': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/textarea/textarea")> & WeappComponent<ComponentProp<"t-textarea">>;
    TToast: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/toast/toast")> & WeappComponent<ComponentProp<"t-toast">>;
    't-toast': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/toast/toast")> & WeappComponent<ComponentProp<"t-toast">>;
    TTransition: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/transition/transition")> & WeappComponent<ComponentProp<"t-transition">>;
    't-transition': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/transition/transition")> & WeappComponent<ComponentProp<"t-transition">>;
    TTreeSelect: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/tree-select/tree-select")> & WeappComponent<ComponentProp<"t-tree-select">>;
    't-tree-select': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/tree-select/tree-select")> & WeappComponent<ComponentProp<"t-tree-select">>;
    TUpload: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/upload/upload")> & WeappComponent<ComponentProp<"t-upload">>;
    't-upload': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/upload/upload")> & WeappComponent<ComponentProp<"t-upload">>;
    TWatermark: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/watermark/watermark")> & WeappComponent<ComponentProp<"t-watermark">>;
    't-watermark': __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/watermark/watermark")> & WeappComponent<ComponentProp<"t-watermark">>;
    VanActionSheet: __WeappComponentImport<typeof import("@vant/weapp/lib/action-sheet")> & WeappComponent<ComponentProp<"van-action-sheet">>;
    'van-action-sheet': __WeappComponentImport<typeof import("@vant/weapp/lib/action-sheet")> & WeappComponent<ComponentProp<"van-action-sheet">>;
    VanArea: __WeappComponentImport<typeof import("@vant/weapp/lib/area")> & WeappComponent<ComponentProp<"van-area">>;
    'van-area': __WeappComponentImport<typeof import("@vant/weapp/lib/area")> & WeappComponent<ComponentProp<"van-area">>;
    VanButton: __WeappComponentImport<typeof import("@vant/weapp/lib/button")> & WeappComponent<ComponentProp<"van-button">>;
    'van-button': __WeappComponentImport<typeof import("@vant/weapp/lib/button")> & WeappComponent<ComponentProp<"van-button">>;
    VanCalendar: __WeappComponentImport<typeof import("@vant/weapp/lib/calendar")> & WeappComponent<ComponentProp<"van-calendar">>;
    'van-calendar': __WeappComponentImport<typeof import("@vant/weapp/lib/calendar")> & WeappComponent<ComponentProp<"van-calendar">>;
    VanCard: __WeappComponentImport<typeof import("@vant/weapp/lib/card")> & WeappComponent<ComponentProp<"van-card">>;
    'van-card': __WeappComponentImport<typeof import("@vant/weapp/lib/card")> & WeappComponent<ComponentProp<"van-card">>;
    VanCascader: __WeappComponentImport<typeof import("@vant/weapp/lib/cascader")> & WeappComponent<ComponentProp<"van-cascader">>;
    'van-cascader': __WeappComponentImport<typeof import("@vant/weapp/lib/cascader")> & WeappComponent<ComponentProp<"van-cascader">>;
    VanCell: __WeappComponentImport<typeof import("@vant/weapp/lib/cell")> & WeappComponent<ComponentProp<"van-cell">>;
    'van-cell': __WeappComponentImport<typeof import("@vant/weapp/lib/cell")> & WeappComponent<ComponentProp<"van-cell">>;
    VanCellGroup: __WeappComponentImport<typeof import("@vant/weapp/lib/cell-group")> & WeappComponent<ComponentProp<"van-cell-group">>;
    'van-cell-group': __WeappComponentImport<typeof import("@vant/weapp/lib/cell-group")> & WeappComponent<ComponentProp<"van-cell-group">>;
    VanCheckbox: __WeappComponentImport<typeof import("@vant/weapp/lib/checkbox")> & WeappComponent<ComponentProp<"van-checkbox">>;
    'van-checkbox': __WeappComponentImport<typeof import("@vant/weapp/lib/checkbox")> & WeappComponent<ComponentProp<"van-checkbox">>;
    VanCheckboxGroup: __WeappComponentImport<typeof import("@vant/weapp/lib/checkbox-group")> & WeappComponent<ComponentProp<"van-checkbox-group">>;
    'van-checkbox-group': __WeappComponentImport<typeof import("@vant/weapp/lib/checkbox-group")> & WeappComponent<ComponentProp<"van-checkbox-group">>;
    VanCircle: __WeappComponentImport<typeof import("@vant/weapp/lib/circle")> & WeappComponent<ComponentProp<"van-circle">>;
    'van-circle': __WeappComponentImport<typeof import("@vant/weapp/lib/circle")> & WeappComponent<ComponentProp<"van-circle">>;
    VanCol: __WeappComponentImport<typeof import("@vant/weapp/lib/col")> & WeappComponent<ComponentProp<"van-col">>;
    'van-col': __WeappComponentImport<typeof import("@vant/weapp/lib/col")> & WeappComponent<ComponentProp<"van-col">>;
    VanCollapse: __WeappComponentImport<typeof import("@vant/weapp/lib/collapse")> & WeappComponent<ComponentProp<"van-collapse">>;
    'van-collapse': __WeappComponentImport<typeof import("@vant/weapp/lib/collapse")> & WeappComponent<ComponentProp<"van-collapse">>;
    VanCollapseItem: __WeappComponentImport<typeof import("@vant/weapp/lib/collapse-item")> & WeappComponent<ComponentProp<"van-collapse-item">>;
    'van-collapse-item': __WeappComponentImport<typeof import("@vant/weapp/lib/collapse-item")> & WeappComponent<ComponentProp<"van-collapse-item">>;
    VanConfigProvider: __WeappComponentImport<typeof import("@vant/weapp/lib/config-provider")> & WeappComponent<ComponentProp<"van-config-provider">>;
    'van-config-provider': __WeappComponentImport<typeof import("@vant/weapp/lib/config-provider")> & WeappComponent<ComponentProp<"van-config-provider">>;
    VanCountDown: __WeappComponentImport<typeof import("@vant/weapp/lib/count-down")> & WeappComponent<ComponentProp<"van-count-down">>;
    'van-count-down': __WeappComponentImport<typeof import("@vant/weapp/lib/count-down")> & WeappComponent<ComponentProp<"van-count-down">>;
    VanDatetimePicker: __WeappComponentImport<typeof import("@vant/weapp/lib/datetime-picker")> & WeappComponent<ComponentProp<"van-datetime-picker">>;
    'van-datetime-picker': __WeappComponentImport<typeof import("@vant/weapp/lib/datetime-picker")> & WeappComponent<ComponentProp<"van-datetime-picker">>;
    VanDefinitions: __WeappComponentImport<typeof import("@vant/weapp/lib/definitions")> & WeappComponent<ComponentProp<"van-definitions">>;
    'van-definitions': __WeappComponentImport<typeof import("@vant/weapp/lib/definitions")> & WeappComponent<ComponentProp<"van-definitions">>;
    VanDialog: __WeappComponentImport<typeof import("@vant/weapp/lib/dialog")> & WeappComponent<ComponentProp<"van-dialog">>;
    'van-dialog': __WeappComponentImport<typeof import("@vant/weapp/lib/dialog")> & WeappComponent<ComponentProp<"van-dialog">>;
    VanDivider: __WeappComponentImport<typeof import("@vant/weapp/lib/divider")> & WeappComponent<ComponentProp<"van-divider">>;
    'van-divider': __WeappComponentImport<typeof import("@vant/weapp/lib/divider")> & WeappComponent<ComponentProp<"van-divider">>;
    VanDropdownItem: __WeappComponentImport<typeof import("@vant/weapp/lib/dropdown-item")> & WeappComponent<ComponentProp<"van-dropdown-item">>;
    'van-dropdown-item': __WeappComponentImport<typeof import("@vant/weapp/lib/dropdown-item")> & WeappComponent<ComponentProp<"van-dropdown-item">>;
    VanDropdownMenu: __WeappComponentImport<typeof import("@vant/weapp/lib/dropdown-menu")> & WeappComponent<ComponentProp<"van-dropdown-menu">>;
    'van-dropdown-menu': __WeappComponentImport<typeof import("@vant/weapp/lib/dropdown-menu")> & WeappComponent<ComponentProp<"van-dropdown-menu">>;
    VanEmpty: __WeappComponentImport<typeof import("@vant/weapp/lib/empty")> & WeappComponent<ComponentProp<"van-empty">>;
    'van-empty': __WeappComponentImport<typeof import("@vant/weapp/lib/empty")> & WeappComponent<ComponentProp<"van-empty">>;
    VanField: __WeappComponentImport<typeof import("@vant/weapp/lib/field")> & WeappComponent<ComponentProp<"van-field">>;
    'van-field': __WeappComponentImport<typeof import("@vant/weapp/lib/field")> & WeappComponent<ComponentProp<"van-field">>;
    VanGoodsAction: __WeappComponentImport<typeof import("@vant/weapp/lib/goods-action")> & WeappComponent<ComponentProp<"van-goods-action">>;
    'van-goods-action': __WeappComponentImport<typeof import("@vant/weapp/lib/goods-action")> & WeappComponent<ComponentProp<"van-goods-action">>;
    VanGoodsActionButton: __WeappComponentImport<typeof import("@vant/weapp/lib/goods-action-button")> & WeappComponent<ComponentProp<"van-goods-action-button">>;
    'van-goods-action-button': __WeappComponentImport<typeof import("@vant/weapp/lib/goods-action-button")> & WeappComponent<ComponentProp<"van-goods-action-button">>;
    VanGoodsActionIcon: __WeappComponentImport<typeof import("@vant/weapp/lib/goods-action-icon")> & WeappComponent<ComponentProp<"van-goods-action-icon">>;
    'van-goods-action-icon': __WeappComponentImport<typeof import("@vant/weapp/lib/goods-action-icon")> & WeappComponent<ComponentProp<"van-goods-action-icon">>;
    VanGrid: __WeappComponentImport<typeof import("@vant/weapp/lib/grid")> & WeappComponent<ComponentProp<"van-grid">>;
    'van-grid': __WeappComponentImport<typeof import("@vant/weapp/lib/grid")> & WeappComponent<ComponentProp<"van-grid">>;
    VanGridItem: __WeappComponentImport<typeof import("@vant/weapp/lib/grid-item")> & WeappComponent<ComponentProp<"van-grid-item">>;
    'van-grid-item': __WeappComponentImport<typeof import("@vant/weapp/lib/grid-item")> & WeappComponent<ComponentProp<"van-grid-item">>;
    VanIcon: __WeappComponentImport<typeof import("@vant/weapp/lib/icon")> & WeappComponent<ComponentProp<"van-icon">>;
    'van-icon': __WeappComponentImport<typeof import("@vant/weapp/lib/icon")> & WeappComponent<ComponentProp<"van-icon">>;
    VanImage: __WeappComponentImport<typeof import("@vant/weapp/lib/image")> & WeappComponent<ComponentProp<"van-image">>;
    'van-image': __WeappComponentImport<typeof import("@vant/weapp/lib/image")> & WeappComponent<ComponentProp<"van-image">>;
    VanIndexAnchor: __WeappComponentImport<typeof import("@vant/weapp/lib/index-anchor")> & WeappComponent<ComponentProp<"van-index-anchor">>;
    'van-index-anchor': __WeappComponentImport<typeof import("@vant/weapp/lib/index-anchor")> & WeappComponent<ComponentProp<"van-index-anchor">>;
    VanIndexBar: __WeappComponentImport<typeof import("@vant/weapp/lib/index-bar")> & WeappComponent<ComponentProp<"van-index-bar">>;
    'van-index-bar': __WeappComponentImport<typeof import("@vant/weapp/lib/index-bar")> & WeappComponent<ComponentProp<"van-index-bar">>;
    VanInfo: __WeappComponentImport<typeof import("@vant/weapp/lib/info")> & WeappComponent<ComponentProp<"van-info">>;
    'van-info': __WeappComponentImport<typeof import("@vant/weapp/lib/info")> & WeappComponent<ComponentProp<"van-info">>;
    VanLoading: __WeappComponentImport<typeof import("@vant/weapp/lib/loading")> & WeappComponent<ComponentProp<"van-loading">>;
    'van-loading': __WeappComponentImport<typeof import("@vant/weapp/lib/loading")> & WeappComponent<ComponentProp<"van-loading">>;
    VanNavBar: __WeappComponentImport<typeof import("@vant/weapp/lib/nav-bar")> & WeappComponent<ComponentProp<"van-nav-bar">>;
    'van-nav-bar': __WeappComponentImport<typeof import("@vant/weapp/lib/nav-bar")> & WeappComponent<ComponentProp<"van-nav-bar">>;
    VanNoticeBar: __WeappComponentImport<typeof import("@vant/weapp/lib/notice-bar")> & WeappComponent<ComponentProp<"van-notice-bar">>;
    'van-notice-bar': __WeappComponentImport<typeof import("@vant/weapp/lib/notice-bar")> & WeappComponent<ComponentProp<"van-notice-bar">>;
    VanNotify: __WeappComponentImport<typeof import("@vant/weapp/lib/notify")> & WeappComponent<ComponentProp<"van-notify">>;
    'van-notify': __WeappComponentImport<typeof import("@vant/weapp/lib/notify")> & WeappComponent<ComponentProp<"van-notify">>;
    VanOverlay: __WeappComponentImport<typeof import("@vant/weapp/lib/overlay")> & WeappComponent<ComponentProp<"van-overlay">>;
    'van-overlay': __WeappComponentImport<typeof import("@vant/weapp/lib/overlay")> & WeappComponent<ComponentProp<"van-overlay">>;
    VanPanel: __WeappComponentImport<typeof import("@vant/weapp/lib/panel")> & WeappComponent<ComponentProp<"van-panel">>;
    'van-panel': __WeappComponentImport<typeof import("@vant/weapp/lib/panel")> & WeappComponent<ComponentProp<"van-panel">>;
    VanPicker: __WeappComponentImport<typeof import("@vant/weapp/lib/picker")> & WeappComponent<ComponentProp<"van-picker">>;
    'van-picker': __WeappComponentImport<typeof import("@vant/weapp/lib/picker")> & WeappComponent<ComponentProp<"van-picker">>;
    VanPickerColumn: __WeappComponentImport<typeof import("@vant/weapp/lib/picker-column")> & WeappComponent<ComponentProp<"van-picker-column">>;
    'van-picker-column': __WeappComponentImport<typeof import("@vant/weapp/lib/picker-column")> & WeappComponent<ComponentProp<"van-picker-column">>;
    VanPopup: __WeappComponentImport<typeof import("@vant/weapp/lib/popup")> & WeappComponent<ComponentProp<"van-popup">>;
    'van-popup': __WeappComponentImport<typeof import("@vant/weapp/lib/popup")> & WeappComponent<ComponentProp<"van-popup">>;
    VanProgress: __WeappComponentImport<typeof import("@vant/weapp/lib/progress")> & WeappComponent<ComponentProp<"van-progress">>;
    'van-progress': __WeappComponentImport<typeof import("@vant/weapp/lib/progress")> & WeappComponent<ComponentProp<"van-progress">>;
    VanRadio: __WeappComponentImport<typeof import("@vant/weapp/lib/radio")> & WeappComponent<ComponentProp<"van-radio">>;
    'van-radio': __WeappComponentImport<typeof import("@vant/weapp/lib/radio")> & WeappComponent<ComponentProp<"van-radio">>;
    VanRadioGroup: __WeappComponentImport<typeof import("@vant/weapp/lib/radio-group")> & WeappComponent<ComponentProp<"van-radio-group">>;
    'van-radio-group': __WeappComponentImport<typeof import("@vant/weapp/lib/radio-group")> & WeappComponent<ComponentProp<"van-radio-group">>;
    VanRate: __WeappComponentImport<typeof import("@vant/weapp/lib/rate")> & WeappComponent<ComponentProp<"van-rate">>;
    'van-rate': __WeappComponentImport<typeof import("@vant/weapp/lib/rate")> & WeappComponent<ComponentProp<"van-rate">>;
    VanRow: __WeappComponentImport<typeof import("@vant/weapp/lib/row")> & WeappComponent<ComponentProp<"van-row">>;
    'van-row': __WeappComponentImport<typeof import("@vant/weapp/lib/row")> & WeappComponent<ComponentProp<"van-row">>;
    VanSearch: __WeappComponentImport<typeof import("@vant/weapp/lib/search")> & WeappComponent<ComponentProp<"van-search">>;
    'van-search': __WeappComponentImport<typeof import("@vant/weapp/lib/search")> & WeappComponent<ComponentProp<"van-search">>;
    VanShareSheet: __WeappComponentImport<typeof import("@vant/weapp/lib/share-sheet")> & WeappComponent<ComponentProp<"van-share-sheet">>;
    'van-share-sheet': __WeappComponentImport<typeof import("@vant/weapp/lib/share-sheet")> & WeappComponent<ComponentProp<"van-share-sheet">>;
    VanSidebar: __WeappComponentImport<typeof import("@vant/weapp/lib/sidebar")> & WeappComponent<ComponentProp<"van-sidebar">>;
    'van-sidebar': __WeappComponentImport<typeof import("@vant/weapp/lib/sidebar")> & WeappComponent<ComponentProp<"van-sidebar">>;
    VanSidebarItem: __WeappComponentImport<typeof import("@vant/weapp/lib/sidebar-item")> & WeappComponent<ComponentProp<"van-sidebar-item">>;
    'van-sidebar-item': __WeappComponentImport<typeof import("@vant/weapp/lib/sidebar-item")> & WeappComponent<ComponentProp<"van-sidebar-item">>;
    VanSkeleton: __WeappComponentImport<typeof import("@vant/weapp/lib/skeleton")> & WeappComponent<ComponentProp<"van-skeleton">>;
    'van-skeleton': __WeappComponentImport<typeof import("@vant/weapp/lib/skeleton")> & WeappComponent<ComponentProp<"van-skeleton">>;
    VanSlider: __WeappComponentImport<typeof import("@vant/weapp/lib/slider")> & WeappComponent<ComponentProp<"van-slider">>;
    'van-slider': __WeappComponentImport<typeof import("@vant/weapp/lib/slider")> & WeappComponent<ComponentProp<"van-slider">>;
    VanStepper: __WeappComponentImport<typeof import("@vant/weapp/lib/stepper")> & WeappComponent<ComponentProp<"van-stepper">>;
    'van-stepper': __WeappComponentImport<typeof import("@vant/weapp/lib/stepper")> & WeappComponent<ComponentProp<"van-stepper">>;
    VanSteps: __WeappComponentImport<typeof import("@vant/weapp/lib/steps")> & WeappComponent<ComponentProp<"van-steps">>;
    'van-steps': __WeappComponentImport<typeof import("@vant/weapp/lib/steps")> & WeappComponent<ComponentProp<"van-steps">>;
    VanSticky: __WeappComponentImport<typeof import("@vant/weapp/lib/sticky")> & WeappComponent<ComponentProp<"van-sticky">>;
    'van-sticky': __WeappComponentImport<typeof import("@vant/weapp/lib/sticky")> & WeappComponent<ComponentProp<"van-sticky">>;
    VanSubmitBar: __WeappComponentImport<typeof import("@vant/weapp/lib/submit-bar")> & WeappComponent<ComponentProp<"van-submit-bar">>;
    'van-submit-bar': __WeappComponentImport<typeof import("@vant/weapp/lib/submit-bar")> & WeappComponent<ComponentProp<"van-submit-bar">>;
    VanSwipeCell: __WeappComponentImport<typeof import("@vant/weapp/lib/swipe-cell")> & WeappComponent<ComponentProp<"van-swipe-cell">>;
    'van-swipe-cell': __WeappComponentImport<typeof import("@vant/weapp/lib/swipe-cell")> & WeappComponent<ComponentProp<"van-swipe-cell">>;
    VanSwitch: __WeappComponentImport<typeof import("@vant/weapp/lib/switch")> & WeappComponent<ComponentProp<"van-switch">>;
    'van-switch': __WeappComponentImport<typeof import("@vant/weapp/lib/switch")> & WeappComponent<ComponentProp<"van-switch">>;
    VanTab: __WeappComponentImport<typeof import("@vant/weapp/lib/tab")> & WeappComponent<ComponentProp<"van-tab">>;
    'van-tab': __WeappComponentImport<typeof import("@vant/weapp/lib/tab")> & WeappComponent<ComponentProp<"van-tab">>;
    VanTabbar: __WeappComponentImport<typeof import("@vant/weapp/lib/tabbar")> & WeappComponent<ComponentProp<"van-tabbar">>;
    'van-tabbar': __WeappComponentImport<typeof import("@vant/weapp/lib/tabbar")> & WeappComponent<ComponentProp<"van-tabbar">>;
    VanTabbarItem: __WeappComponentImport<typeof import("@vant/weapp/lib/tabbar-item")> & WeappComponent<ComponentProp<"van-tabbar-item">>;
    'van-tabbar-item': __WeappComponentImport<typeof import("@vant/weapp/lib/tabbar-item")> & WeappComponent<ComponentProp<"van-tabbar-item">>;
    VanTabs: __WeappComponentImport<typeof import("@vant/weapp/lib/tabs")> & WeappComponent<ComponentProp<"van-tabs">>;
    'van-tabs': __WeappComponentImport<typeof import("@vant/weapp/lib/tabs")> & WeappComponent<ComponentProp<"van-tabs">>;
    VanTag: __WeappComponentImport<typeof import("@vant/weapp/lib/tag")> & WeappComponent<ComponentProp<"van-tag">>;
    'van-tag': __WeappComponentImport<typeof import("@vant/weapp/lib/tag")> & WeappComponent<ComponentProp<"van-tag">>;
    VanToast: __WeappComponentImport<typeof import("@vant/weapp/lib/toast")> & WeappComponent<ComponentProp<"van-toast">>;
    'van-toast': __WeappComponentImport<typeof import("@vant/weapp/lib/toast")> & WeappComponent<ComponentProp<"van-toast">>;
    VanTransition: __WeappComponentImport<typeof import("@vant/weapp/lib/transition")> & WeappComponent<ComponentProp<"van-transition">>;
    'van-transition': __WeappComponentImport<typeof import("@vant/weapp/lib/transition")> & WeappComponent<ComponentProp<"van-transition">>;
    VanTreeSelect: __WeappComponentImport<typeof import("@vant/weapp/lib/tree-select")> & WeappComponent<ComponentProp<"van-tree-select">>;
    'van-tree-select': __WeappComponentImport<typeof import("@vant/weapp/lib/tree-select")> & WeappComponent<ComponentProp<"van-tree-select">>;
    VanUploader: __WeappComponentImport<typeof import("@vant/weapp/lib/uploader")> & WeappComponent<ComponentProp<"van-uploader">>;
    'van-uploader': __WeappComponentImport<typeof import("@vant/weapp/lib/uploader")> & WeappComponent<ComponentProp<"van-uploader">>;
  }
}

// 用于 TSX 支持
declare global {
  const TActionSheet: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/action-sheet/action-sheet")> & WeappComponent<ComponentProp<"t-action-sheet">>
  const TAvatar: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/avatar/avatar")> & WeappComponent<ComponentProp<"t-avatar">>
  const TAvatarGroup: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/avatar-group/avatar-group")> & WeappComponent<ComponentProp<"t-avatar-group">>
  const TBackTop: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/back-top/back-top")> & WeappComponent<ComponentProp<"t-back-top">>
  const TBadge: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/badge/badge")> & WeappComponent<ComponentProp<"t-badge">>
  const TButton: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/button/button")> & WeappComponent<ComponentProp<"t-button">>
  const TCalendar: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/calendar/calendar")> & WeappComponent<ComponentProp<"t-calendar">>
  const TCascader: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/cascader/cascader")> & WeappComponent<ComponentProp<"t-cascader">>
  const TCell: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/cell/cell")> & WeappComponent<ComponentProp<"t-cell">>
  const TCellGroup: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/cell-group/cell-group")> & WeappComponent<ComponentProp<"t-cell-group">>
  const TCheckTag: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/check-tag/check-tag")> & WeappComponent<ComponentProp<"t-check-tag">>
  const TCheckbox: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/checkbox/checkbox")> & WeappComponent<ComponentProp<"t-checkbox">>
  const TCheckboxGroup: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/checkbox-group/checkbox-group")> & WeappComponent<ComponentProp<"t-checkbox-group">>
  const TCol: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/col/col")> & WeappComponent<ComponentProp<"t-col">>
  const TCollapse: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/collapse/collapse")> & WeappComponent<ComponentProp<"t-collapse">>
  const TCollapsePanel: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/collapse-panel/collapse-panel")> & WeappComponent<ComponentProp<"t-collapse-panel">>
  const TColorPicker: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/color-picker/color-picker")> & WeappComponent<ComponentProp<"t-color-picker">>
  const TCountDown: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/count-down/count-down")> & WeappComponent<ComponentProp<"t-count-down">>
  const TDateTimePicker: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/date-time-picker/date-time-picker")> & WeappComponent<ComponentProp<"t-date-time-picker">>
  const TDialog: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/dialog/dialog")> & WeappComponent<ComponentProp<"t-dialog">>
  const TDivider: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/divider/divider")> & WeappComponent<ComponentProp<"t-divider">>
  const TDrawer: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/drawer/drawer")> & WeappComponent<ComponentProp<"t-drawer">>
  const TDropdownItem: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/dropdown-item/dropdown-item")> & WeappComponent<ComponentProp<"t-dropdown-item">>
  const TDropdownMenu: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/dropdown-menu/dropdown-menu")> & WeappComponent<ComponentProp<"t-dropdown-menu">>
  const TEmpty: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/empty/empty")> & WeappComponent<ComponentProp<"t-empty">>
  const TFab: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/fab/fab")> & WeappComponent<ComponentProp<"t-fab">>
  const TFooter: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/footer/footer")> & WeappComponent<ComponentProp<"t-footer">>
  const TForm: WeappComponent<ComponentProp<"t-form">>
  const TFormItem: WeappComponent<ComponentProp<"t-form-item">>
  const TGrid: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/grid/grid")> & WeappComponent<ComponentProp<"t-grid">>
  const TGridItem: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/grid-item/grid-item")> & WeappComponent<ComponentProp<"t-grid-item">>
  const TGuide: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/guide/guide")> & WeappComponent<ComponentProp<"t-guide">>
  const TIcon: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/icon/icon")> & WeappComponent<ComponentProp<"t-icon">>
  const TImage: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/image/image")> & WeappComponent<ComponentProp<"t-image">>
  const TImageViewer: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/image-viewer/image-viewer")> & WeappComponent<ComponentProp<"t-image-viewer">>
  const TIndexes: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/indexes/indexes")> & WeappComponent<ComponentProp<"t-indexes">>
  const TIndexesAnchor: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/indexes-anchor/indexes-anchor")> & WeappComponent<ComponentProp<"t-indexes-anchor">>
  const TInput: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/input/input")> & WeappComponent<ComponentProp<"t-input">>
  const TLink: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/link/link")> & WeappComponent<ComponentProp<"t-link">>
  const TLoading: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/loading/loading")> & WeappComponent<ComponentProp<"t-loading">>
  const TMessage: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/message/message")> & WeappComponent<ComponentProp<"t-message">>
  const TMessageItem: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/message-item/message-item")> & WeappComponent<ComponentProp<"t-message-item">>
  const TNavbar: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/navbar/navbar")> & WeappComponent<ComponentProp<"t-navbar">>
  const TNoticeBar: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/notice-bar/notice-bar")> & WeappComponent<ComponentProp<"t-notice-bar">>
  const TOverlay: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/overlay/overlay")> & WeappComponent<ComponentProp<"t-overlay">>
  const TPicker: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/picker/picker")> & WeappComponent<ComponentProp<"t-picker">>
  const TPickerItem: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/picker-item/picker-item")> & WeappComponent<ComponentProp<"t-picker-item">>
  const TPopup: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/popup/popup")> & WeappComponent<ComponentProp<"t-popup">>
  const TProgress: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/progress/progress")> & WeappComponent<ComponentProp<"t-progress">>
  const TPullDownRefresh: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/pull-down-refresh/pull-down-refresh")> & WeappComponent<ComponentProp<"t-pull-down-refresh">>
  const TQrcode: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/qrcode/qrcode")> & WeappComponent<ComponentProp<"t-qrcode">>
  const TRadio: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/radio/radio")> & WeappComponent<ComponentProp<"t-radio">>
  const TRadioGroup: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/radio-group/radio-group")> & WeappComponent<ComponentProp<"t-radio-group">>
  const TRate: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/rate/rate")> & WeappComponent<ComponentProp<"t-rate">>
  const TResult: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/result/result")> & WeappComponent<ComponentProp<"t-result">>
  const TRow: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/row/row")> & WeappComponent<ComponentProp<"t-row">>
  const TScrollView: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/scroll-view/scroll-view")> & WeappComponent<ComponentProp<"t-scroll-view">>
  const TSearch: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/search/search")> & WeappComponent<ComponentProp<"t-search">>
  const TSideBar: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/side-bar/side-bar")> & WeappComponent<ComponentProp<"t-side-bar">>
  const TSideBarItem: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/side-bar-item/side-bar-item")> & WeappComponent<ComponentProp<"t-side-bar-item">>
  const TSkeleton: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/skeleton/skeleton")> & WeappComponent<ComponentProp<"t-skeleton">>
  const TSlider: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/slider/slider")> & WeappComponent<ComponentProp<"t-slider">>
  const TStepItem: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/step-item/step-item")> & WeappComponent<ComponentProp<"t-step-item">>
  const TStepper: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/stepper/stepper")> & WeappComponent<ComponentProp<"t-stepper">>
  const TSteps: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/steps/steps")> & WeappComponent<ComponentProp<"t-steps">>
  const TSticky: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/sticky/sticky")> & WeappComponent<ComponentProp<"t-sticky">>
  const TSwipeCell: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/swipe-cell/swipe-cell")> & WeappComponent<ComponentProp<"t-swipe-cell">>
  const TSwiper: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/swiper/swiper")> & WeappComponent<ComponentProp<"t-swiper">>
  const TSwiperNav: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/swiper-nav/swiper-nav")> & WeappComponent<ComponentProp<"t-swiper-nav">>
  const TSwitch: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/switch/switch")> & WeappComponent<ComponentProp<"t-switch">>
  const TTabBar: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/tab-bar/tab-bar")> & WeappComponent<ComponentProp<"t-tab-bar">>
  const TTabBarItem: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/tab-bar-item/tab-bar-item")> & WeappComponent<ComponentProp<"t-tab-bar-item">>
  const TTabPanel: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/tab-panel/tab-panel")> & WeappComponent<ComponentProp<"t-tab-panel">>
  const TTabs: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/tabs/tabs")> & WeappComponent<ComponentProp<"t-tabs">>
  const TTag: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/tag/tag")> & WeappComponent<ComponentProp<"t-tag">>
  const TTextarea: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/textarea/textarea")> & WeappComponent<ComponentProp<"t-textarea">>
  const TToast: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/toast/toast")> & WeappComponent<ComponentProp<"t-toast">>
  const TTransition: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/transition/transition")> & WeappComponent<ComponentProp<"t-transition">>
  const TTreeSelect: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/tree-select/tree-select")> & WeappComponent<ComponentProp<"t-tree-select">>
  const TUpload: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/upload/upload")> & WeappComponent<ComponentProp<"t-upload">>
  const TWatermark: __WeappComponentImport<typeof import("tdesign-miniprogram/miniprogram_dist/watermark/watermark")> & WeappComponent<ComponentProp<"t-watermark">>
  const VanActionSheet: __WeappComponentImport<typeof import("@vant/weapp/lib/action-sheet")> & WeappComponent<ComponentProp<"van-action-sheet">>
  const VanArea: __WeappComponentImport<typeof import("@vant/weapp/lib/area")> & WeappComponent<ComponentProp<"van-area">>
  const VanButton: __WeappComponentImport<typeof import("@vant/weapp/lib/button")> & WeappComponent<ComponentProp<"van-button">>
  const VanCalendar: __WeappComponentImport<typeof import("@vant/weapp/lib/calendar")> & WeappComponent<ComponentProp<"van-calendar">>
  const VanCard: __WeappComponentImport<typeof import("@vant/weapp/lib/card")> & WeappComponent<ComponentProp<"van-card">>
  const VanCascader: __WeappComponentImport<typeof import("@vant/weapp/lib/cascader")> & WeappComponent<ComponentProp<"van-cascader">>
  const VanCell: __WeappComponentImport<typeof import("@vant/weapp/lib/cell")> & WeappComponent<ComponentProp<"van-cell">>
  const VanCellGroup: __WeappComponentImport<typeof import("@vant/weapp/lib/cell-group")> & WeappComponent<ComponentProp<"van-cell-group">>
  const VanCheckbox: __WeappComponentImport<typeof import("@vant/weapp/lib/checkbox")> & WeappComponent<ComponentProp<"van-checkbox">>
  const VanCheckboxGroup: __WeappComponentImport<typeof import("@vant/weapp/lib/checkbox-group")> & WeappComponent<ComponentProp<"van-checkbox-group">>
  const VanCircle: __WeappComponentImport<typeof import("@vant/weapp/lib/circle")> & WeappComponent<ComponentProp<"van-circle">>
  const VanCol: __WeappComponentImport<typeof import("@vant/weapp/lib/col")> & WeappComponent<ComponentProp<"van-col">>
  const VanCollapse: __WeappComponentImport<typeof import("@vant/weapp/lib/collapse")> & WeappComponent<ComponentProp<"van-collapse">>
  const VanCollapseItem: __WeappComponentImport<typeof import("@vant/weapp/lib/collapse-item")> & WeappComponent<ComponentProp<"van-collapse-item">>
  const VanConfigProvider: __WeappComponentImport<typeof import("@vant/weapp/lib/config-provider")> & WeappComponent<ComponentProp<"van-config-provider">>
  const VanCountDown: __WeappComponentImport<typeof import("@vant/weapp/lib/count-down")> & WeappComponent<ComponentProp<"van-count-down">>
  const VanDatetimePicker: __WeappComponentImport<typeof import("@vant/weapp/lib/datetime-picker")> & WeappComponent<ComponentProp<"van-datetime-picker">>
  const VanDefinitions: __WeappComponentImport<typeof import("@vant/weapp/lib/definitions")> & WeappComponent<ComponentProp<"van-definitions">>
  const VanDialog: __WeappComponentImport<typeof import("@vant/weapp/lib/dialog")> & WeappComponent<ComponentProp<"van-dialog">>
  const VanDivider: __WeappComponentImport<typeof import("@vant/weapp/lib/divider")> & WeappComponent<ComponentProp<"van-divider">>
  const VanDropdownItem: __WeappComponentImport<typeof import("@vant/weapp/lib/dropdown-item")> & WeappComponent<ComponentProp<"van-dropdown-item">>
  const VanDropdownMenu: __WeappComponentImport<typeof import("@vant/weapp/lib/dropdown-menu")> & WeappComponent<ComponentProp<"van-dropdown-menu">>
  const VanEmpty: __WeappComponentImport<typeof import("@vant/weapp/lib/empty")> & WeappComponent<ComponentProp<"van-empty">>
  const VanField: __WeappComponentImport<typeof import("@vant/weapp/lib/field")> & WeappComponent<ComponentProp<"van-field">>
  const VanGoodsAction: __WeappComponentImport<typeof import("@vant/weapp/lib/goods-action")> & WeappComponent<ComponentProp<"van-goods-action">>
  const VanGoodsActionButton: __WeappComponentImport<typeof import("@vant/weapp/lib/goods-action-button")> & WeappComponent<ComponentProp<"van-goods-action-button">>
  const VanGoodsActionIcon: __WeappComponentImport<typeof import("@vant/weapp/lib/goods-action-icon")> & WeappComponent<ComponentProp<"van-goods-action-icon">>
  const VanGrid: __WeappComponentImport<typeof import("@vant/weapp/lib/grid")> & WeappComponent<ComponentProp<"van-grid">>
  const VanGridItem: __WeappComponentImport<typeof import("@vant/weapp/lib/grid-item")> & WeappComponent<ComponentProp<"van-grid-item">>
  const VanIcon: __WeappComponentImport<typeof import("@vant/weapp/lib/icon")> & WeappComponent<ComponentProp<"van-icon">>
  const VanImage: __WeappComponentImport<typeof import("@vant/weapp/lib/image")> & WeappComponent<ComponentProp<"van-image">>
  const VanIndexAnchor: __WeappComponentImport<typeof import("@vant/weapp/lib/index-anchor")> & WeappComponent<ComponentProp<"van-index-anchor">>
  const VanIndexBar: __WeappComponentImport<typeof import("@vant/weapp/lib/index-bar")> & WeappComponent<ComponentProp<"van-index-bar">>
  const VanInfo: __WeappComponentImport<typeof import("@vant/weapp/lib/info")> & WeappComponent<ComponentProp<"van-info">>
  const VanLoading: __WeappComponentImport<typeof import("@vant/weapp/lib/loading")> & WeappComponent<ComponentProp<"van-loading">>
  const VanNavBar: __WeappComponentImport<typeof import("@vant/weapp/lib/nav-bar")> & WeappComponent<ComponentProp<"van-nav-bar">>
  const VanNoticeBar: __WeappComponentImport<typeof import("@vant/weapp/lib/notice-bar")> & WeappComponent<ComponentProp<"van-notice-bar">>
  const VanNotify: __WeappComponentImport<typeof import("@vant/weapp/lib/notify")> & WeappComponent<ComponentProp<"van-notify">>
  const VanOverlay: __WeappComponentImport<typeof import("@vant/weapp/lib/overlay")> & WeappComponent<ComponentProp<"van-overlay">>
  const VanPanel: __WeappComponentImport<typeof import("@vant/weapp/lib/panel")> & WeappComponent<ComponentProp<"van-panel">>
  const VanPicker: __WeappComponentImport<typeof import("@vant/weapp/lib/picker")> & WeappComponent<ComponentProp<"van-picker">>
  const VanPickerColumn: __WeappComponentImport<typeof import("@vant/weapp/lib/picker-column")> & WeappComponent<ComponentProp<"van-picker-column">>
  const VanPopup: __WeappComponentImport<typeof import("@vant/weapp/lib/popup")> & WeappComponent<ComponentProp<"van-popup">>
  const VanProgress: __WeappComponentImport<typeof import("@vant/weapp/lib/progress")> & WeappComponent<ComponentProp<"van-progress">>
  const VanRadio: __WeappComponentImport<typeof import("@vant/weapp/lib/radio")> & WeappComponent<ComponentProp<"van-radio">>
  const VanRadioGroup: __WeappComponentImport<typeof import("@vant/weapp/lib/radio-group")> & WeappComponent<ComponentProp<"van-radio-group">>
  const VanRate: __WeappComponentImport<typeof import("@vant/weapp/lib/rate")> & WeappComponent<ComponentProp<"van-rate">>
  const VanRow: __WeappComponentImport<typeof import("@vant/weapp/lib/row")> & WeappComponent<ComponentProp<"van-row">>
  const VanSearch: __WeappComponentImport<typeof import("@vant/weapp/lib/search")> & WeappComponent<ComponentProp<"van-search">>
  const VanShareSheet: __WeappComponentImport<typeof import("@vant/weapp/lib/share-sheet")> & WeappComponent<ComponentProp<"van-share-sheet">>
  const VanSidebar: __WeappComponentImport<typeof import("@vant/weapp/lib/sidebar")> & WeappComponent<ComponentProp<"van-sidebar">>
  const VanSidebarItem: __WeappComponentImport<typeof import("@vant/weapp/lib/sidebar-item")> & WeappComponent<ComponentProp<"van-sidebar-item">>
  const VanSkeleton: __WeappComponentImport<typeof import("@vant/weapp/lib/skeleton")> & WeappComponent<ComponentProp<"van-skeleton">>
  const VanSlider: __WeappComponentImport<typeof import("@vant/weapp/lib/slider")> & WeappComponent<ComponentProp<"van-slider">>
  const VanStepper: __WeappComponentImport<typeof import("@vant/weapp/lib/stepper")> & WeappComponent<ComponentProp<"van-stepper">>
  const VanSteps: __WeappComponentImport<typeof import("@vant/weapp/lib/steps")> & WeappComponent<ComponentProp<"van-steps">>
  const VanSticky: __WeappComponentImport<typeof import("@vant/weapp/lib/sticky")> & WeappComponent<ComponentProp<"van-sticky">>
  const VanSubmitBar: __WeappComponentImport<typeof import("@vant/weapp/lib/submit-bar")> & WeappComponent<ComponentProp<"van-submit-bar">>
  const VanSwipeCell: __WeappComponentImport<typeof import("@vant/weapp/lib/swipe-cell")> & WeappComponent<ComponentProp<"van-swipe-cell">>
  const VanSwitch: __WeappComponentImport<typeof import("@vant/weapp/lib/switch")> & WeappComponent<ComponentProp<"van-switch">>
  const VanTab: __WeappComponentImport<typeof import("@vant/weapp/lib/tab")> & WeappComponent<ComponentProp<"van-tab">>
  const VanTabbar: __WeappComponentImport<typeof import("@vant/weapp/lib/tabbar")> & WeappComponent<ComponentProp<"van-tabbar">>
  const VanTabbarItem: __WeappComponentImport<typeof import("@vant/weapp/lib/tabbar-item")> & WeappComponent<ComponentProp<"van-tabbar-item">>
  const VanTabs: __WeappComponentImport<typeof import("@vant/weapp/lib/tabs")> & WeappComponent<ComponentProp<"van-tabs">>
  const VanTag: __WeappComponentImport<typeof import("@vant/weapp/lib/tag")> & WeappComponent<ComponentProp<"van-tag">>
  const VanToast: __WeappComponentImport<typeof import("@vant/weapp/lib/toast")> & WeappComponent<ComponentProp<"van-toast">>
  const VanTransition: __WeappComponentImport<typeof import("@vant/weapp/lib/transition")> & WeappComponent<ComponentProp<"van-transition">>
  const VanTreeSelect: __WeappComponentImport<typeof import("@vant/weapp/lib/tree-select")> & WeappComponent<ComponentProp<"van-tree-select">>
  const VanUploader: __WeappComponentImport<typeof import("@vant/weapp/lib/uploader")> & WeappComponent<ComponentProp<"van-uploader">>
}
