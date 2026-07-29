import { componentScenarios } from '../../e2e-apps/wot-ui-compat/src/scenarios'
import { defineComponentLibraryWebSuite } from '../component-library/webSuite'

defineComponentLibraryWebSuite({
  appRoot: 'e2e-apps/wot-ui-compat',
  baselineRoot: 'e2e/web-runtime/baselines/wot-ui-compat/web',
  componentFilterEnv: 'WOT_UI_COMPONENT_FILTER',
  defaultPort: 5182,
  expectedCount: 99,
  outputRoot: '.tmp/wot-ui-compat/web',
  portEnv: 'WOT_UI_WEB_E2E_PORT',
  progressEnv: 'WOT_UI_E2E_PROGRESS',
  progressLabel: 'wot-ui-web',
  scenarios: componentScenarios,
  serverPortEnv: 'WOT_UI_WEB_PORT',
  suiteName: 'Wot UI 2.2.0 Web 全组件兼容',
  updateBaselinesEnv: 'WOT_UI_UPDATE_BASELINES',
})
