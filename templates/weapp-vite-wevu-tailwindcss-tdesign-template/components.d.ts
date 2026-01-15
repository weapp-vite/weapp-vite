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

declare module 'wevu' {
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
}
