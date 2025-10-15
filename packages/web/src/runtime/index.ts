export { defineComponent } from './component'
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
export { createTemplate, renderTemplate } from './template'
export type { TemplateRenderer, TemplateScope } from './template'
