import { componentScenarios } from '../../e2e-apps/wot-ui-compat/src/scenarios'
import { defineComponentLibraryRuntimeSuite } from '../component-library/runtimeSuite'

defineComponentLibraryRuntimeSuite({
  appRoot: 'e2e-apps/wot-ui-compat',
  baselineRoot: 'e2e/ide/baselines/wot-ui-compat/wechat',
  componentFilterEnv: 'WOT_UI_COMPONENT_FILTER',
  expectedCount: 99,
  outputRoot: '.tmp/wot-ui-compat/wechat',
  progressLabel: 'wot-ui',
  scenarios: componentScenarios,
  suiteName: 'Wot UI 2.2.0 全组件运行时兼容',
  updateBaselinesEnv: 'WOT_UI_UPDATE_WECHAT_BASELINES',
})
