import { expect } from 'vitest'
import { componentScenarios } from '../../e2e-apps/wot-ui-compat/src/scenarios'
import { defineComponentLibraryRuntimeSuite } from '../component-library/runtimeSuite'

defineComponentLibraryRuntimeSuite({
  appRoot: 'e2e-apps/wot-ui-compat',
  baselineRoot: 'e2e/ide/baselines/wot-ui-compat/wechat',
  componentFilterEnv: 'WOT_UI_COMPONENT_FILTER',
  runtimeModeEnv: 'WEAPP_VITE_COMPONENT_LIBRARY_MODE',
  expectedCount: 99,
  outputRoot: '.tmp/wot-ui-compat/wechat',
  progressLabel: 'wot-ui',
  sessionReadyRoute: '/pages/bootstrap/index',
  sessionReadySelector: '.bootstrap-page',
  scenarios: componentScenarios,
  async assertScenario({ miniProgram, scenario }) {
    if (scenario.component !== 'wd-select-picker') {
      return
    }
    // 同一场景供真实 IDE 与 headless 复用，验证仅供增强插槽使用的 owner 数据已发送。
    await expect.poll(() => miniProgram.evaluate(() => {
      const page = getCurrentPages().at(-1) as any
      const picker = page?.selectComponent('#e2e-component')
      return {
        selected: picker?.data.selectList,
        values: picker?.data.filterColumns?.map((column: { value: string }) => column.value),
      }
    }), { timeout: 5_000 }).toEqual({ selected: [], values: ['option-a', 'option-b'] })
  },
  suiteName: 'Wot UI 2.2.0 全组件运行时兼容',
  updateBaselinesEnv: 'WOT_UI_UPDATE_WECHAT_BASELINES',
  visualComponents: [
    'wd-avatar',
    'wd-badge',
    'wd-button',
    'wd-card',
    'wd-cell',
    'wd-divider',
    'wd-icon',
    'wd-input',
    'wd-progress',
    'wd-tag',
  ],
})
