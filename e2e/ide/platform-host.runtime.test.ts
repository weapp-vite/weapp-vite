import { access } from 'node:fs/promises'
import { createRequire } from 'node:module'
// eslint-disable-next-line e18e/ban-dependencies -- 严格消费项目必须通过宿主原生命令构建。
import { execa } from 'execa'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const root = process.env.WEAPP_VITE_E2E_PLATFORM_PROJECT ?? path.resolve(import.meta.dirname, '../../templates/weapp-vite-multi-platform-sfc-template')
const host = process.env.WEAPP_VITE_E2E_COMPILER_HOST ?? 'wv'
const route = '/pages/index/index'
let miniProgram: any

describe('multi-platform compiler host runtime', { concurrent: false }, () => {
  beforeAll(async () => {
    const require = createRequire(path.join(root, 'package.json'))
    const packageName = host === 'wv' ? 'weapp-vite' : host
    const cli = path.join(path.dirname(require.resolve(`${packageName}/package.json`)), host === 'wv' ? 'bin/weapp-vite.js' : host === 'vite-plus' ? 'bin/vp' : 'bin/vite.js')
    const args = process.env.WEAPP_VITE_E2E_PLATFORM_PROJECT ? ['--config', 'vite.weapp.config.mts'] : ['--platform', 'weapp']
    await execa(process.execPath, [cli, 'build', ...args], { cwd: root })
    for (const file of ['app.json', 'app.js', 'pages/index/index.js', 'pages/index/index.wxml', 'pages/index/index.json', 'components/PlatformCard/index.js', 'components/PlatformCard/index.json', 'components/PlatformCard/index.wxml']) {
      await access(path.join(root, 'dist/weapp/dist', file))
    }
    await access(path.join(root, 'dist/weapp/project.config.json'))
    miniProgram = await launchAutomator({ projectPath: path.join(root, 'dist/weapp'), warmupRoute: route, warmupRootSelectors: ['.page-shell'], retryWarmupTimeout: true })
  }, 120_000)
  afterAll(async () => {
    await miniProgram?.close()
  })

  it('renders the selected platform and restores component state on page reentry', async (context) => {
    const dom = createDomAcceptance(context, 'templates/weapp-vite-multi-platform-sfc-template', [
      { id: 'platform-mounted', route, action: '确认目标平台和 SFC 组件首屏', nodes: [{ selector: '#platform-marker', text: 'MP_PLATFORM=weapp' }, { selector: '#component-platform', scope: ['#platform-card-host'], text: 'weapp' }, { selector: '#counter-value', text: '0' }] },
      { id: 'platform-updated', route, action: '点击按钮确认响应式状态及派生值', nodes: [{ selector: '#counter-value', text: '1' }, { selector: '#counter-doubled', text: 'doubled=2' }] },
      { id: 'platform-reentry', route, action: '重新进入页面确认状态重建', nodes: [{ selector: '#counter-value', text: '0' }, { selector: '#counter-doubled', text: 'doubled=0' }] },
    ])
    const collector = attachRuntimeErrorCollector(miniProgram)
    try {
      const page = await miniProgram.reLaunch(route)
      await dom.check('platform-mounted', miniProgram, page)
      await (await page.$('#increment-button')).tap()
      await dom.check('platform-updated', miniProgram, page)
      const second = await miniProgram.reLaunch(route)
      await dom.check('platform-reentry', miniProgram, second)
      expect(collector.getSince(0)).toEqual([])
    }
    finally { collector.dispose() }
  })
})
