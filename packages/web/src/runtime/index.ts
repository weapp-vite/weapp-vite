export { defineComponent } from './component'
export { createRenderContext } from './renderContext'
export { setupRpx } from './rpx'
export { createTemplate, renderTemplate } from './template'
export {
  initializePageRoutes,
  navigateBack,
  navigateTo,
  redirectTo,
  registerApp,
  registerComponent,
  registerPage,
  reLaunch,
  switchTab,
} from './polyfill'
export { injectStyle, removeStyle } from './style'
export type { TemplateRenderer, TemplateScope } from './template'
export type { RenderContext } from './renderContext'
export type { RpxConfig } from './rpx'
