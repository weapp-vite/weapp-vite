import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { expect } from 'vitest'
import { componentScenarios } from '../../e2e-apps/uview-plus-compat/src/scenarios'
import { defineComponentLibraryWebSuite } from '../component-library/webSuite'

defineComponentLibraryWebSuite({
  appRoot: 'e2e-apps/uview-plus-compat',
  baselineRoot: 'e2e/web-runtime/baselines/uview-plus-compat/web',
  componentFilterEnv: 'UVIEW_PLUS_COMPONENT_FILTER',
  defaultPort: 5183,
  expectedCount: 139,
  outputRoot: '.tmp/uview-plus-compat/web',
  portEnv: 'UVIEW_PLUS_WEB_E2E_PORT',
  async prepareContext(context, appRoot) {
    const require = createRequire(path.join(appRoot, 'package.json'))
    const font = await readFile(require.resolve('uview-plus/components/u-icon/upicon.ttf'))
    // 使用锁文件对应组件包内的真实字体，精确替代同一字体的 CDN 请求。
    await context.route('https://at.alicdn.com/t/font_2225171_8kdcwk4po24.ttf', route => route.fulfill({
      body: font,
      contentType: 'font/ttf',
    }))
  },
  progressEnv: 'UVIEW_PLUS_E2E_PROGRESS',
  progressLabel: 'uview-plus-web',
  scenarios: componentScenarios,
  serverPortEnv: 'UVIEW_PLUS_WEB_PORT',
  suiteName: 'uview-plus 3.8.130 Web 全组件兼容',
  updateBaselinesEnv: 'UVIEW_PLUS_UPDATE_BASELINES',
  async verifyRendered(page, scenario) {
    if (scenario.component === 'up-icon') {
      expect(await page.evaluate(() => Array.from(document.fonts).some(
        font => font.family === 'uicon-iconfont' && font.status === 'loaded',
      ))).toBe(true)
    }
  },
})
