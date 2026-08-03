import { componentScenarios } from '../../e2e-apps/uview-plus-compat/src/scenarios'
import { defineComponentLibraryRuntimeSuite } from '../component-library/runtimeSuite'

defineComponentLibraryRuntimeSuite({
  appRoot: 'e2e-apps/uview-plus-compat',
  baselineRoot: 'e2e/ide/baselines/uview-plus-compat/wechat',
  componentFilterEnv: 'UVIEW_PLUS_COMPONENT_FILTER',
  devtoolsEngineBuildFallbackSettleMs: 8_000,
  devtoolsRefreshProjectAfterConnect: true,
  devtoolsScreenshotSessionLimit: 72,
  devtoolsWarmupScenarioRoute: false,
  expectedCount: 135,
  ignoredRuntimeErrorPatterns: [
    /^\[console:error\] \{"type":"error","args":\[\{\}\]\}$/,
  ],
  methodReadinessFastPath: true,
  outputRoot: '.tmp/uview-plus-compat/wechat',
  progressLabel: 'uview-plus',
  sessionReadyRoute: '/pages/bootstrap/index',
  sessionReadySelector: '.bootstrap-page',
  screenshotSettleOverrides: {
    'up-action-sheet': 1_500,
  },
  scenarios: componentScenarios,
  suiteName: 'uview-plus 3.8.86 全组件运行时兼容',
  testTimeout: 2_400_000,
  updateBaselinesEnv: 'UVIEW_PLUS_UPDATE_WECHAT_BASELINES',
})
