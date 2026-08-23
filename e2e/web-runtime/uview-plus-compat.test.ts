import { componentScenarios } from '../../e2e-apps/uview-plus-compat/src/scenarios'
import { defineComponentLibraryWebSuite } from '../component-library/webSuite'

defineComponentLibraryWebSuite({
  appRoot: 'e2e-apps/uview-plus-compat',
  baselineRoot: 'e2e/web-runtime/baselines/uview-plus-compat/web',
  componentFilterEnv: 'UVIEW_PLUS_COMPONENT_FILTER',
  defaultPort: 5183,
  expectedCount: 137,
  outputRoot: '.tmp/uview-plus-compat/web',
  portEnv: 'UVIEW_PLUS_WEB_E2E_PORT',
  progressEnv: 'UVIEW_PLUS_E2E_PROGRESS',
  progressLabel: 'uview-plus-web',
  scenarios: componentScenarios,
  serverPortEnv: 'UVIEW_PLUS_WEB_PORT',
  suiteName: 'uview-plus 3.8.112 Web 全组件兼容',
  updateBaselinesEnv: 'UVIEW_PLUS_UPDATE_BASELINES',
})
