export { defineComponent } from './component'
export { setNavigationBarMetrics } from './navigationBar'
export type { NavigationBarMetrics } from './navigationBar'
export {
  hideNavigationBarLoading,
  initializePageRoutes,
  navigateBack,
  navigateTo,
  redirectTo,
  registerApp,
  registerComponent,
  registerPage,
  reLaunch,
  setNavigationBarColor,
  setNavigationBarTitle,
  showNavigationBarLoading,
  switchTab,
} from './polyfill'
export { createRenderContext } from './renderContext'
export type { RenderContext } from './renderContext'
export { setupRpx } from './rpx'
export type { RpxConfig } from './rpx'
export { injectStyle, removeStyle } from './style'
export { createTemplate, renderTemplate } from './template'
export type { TemplateRenderer, TemplateScope } from './template'
