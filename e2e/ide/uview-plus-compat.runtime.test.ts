import { componentScenarios } from '../../e2e-apps/uview-plus-compat/src/scenarios'
import { defineComponentLibraryRuntimeSuite } from '../component-library/runtimeSuite'

defineComponentLibraryRuntimeSuite({
  appRoot: 'e2e-apps/uview-plus-compat',
  baselineRoot: 'e2e/ide/baselines/uview-plus-compat/wechat',
  componentFilterEnv: 'UVIEW_PLUS_COMPONENT_FILTER',
  expectedCount: 135,
  outputRoot: '.tmp/uview-plus-compat/wechat',
  progressLabel: 'uview-plus',
  scenarios: componentScenarios,
  suiteName: 'uview-plus 3.8.86 全组件运行时兼容',
  testTimeout: 2_400_000,
  updateBaselinesEnv: 'UVIEW_PLUS_UPDATE_WECHAT_BASELINES',
})
