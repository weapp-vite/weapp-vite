import { access, readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
// eslint-disable-next-line e18e/ban-dependencies -- 三入口消费需使用跨平台原生命令。
import { execa } from 'execa'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const root = process.env.WEAPP_VITE_E2E_LIB_PROJECT ?? path.resolve(import.meta.dirname, '../../e2e-apps/lib-mode')
const host = process.env.WEAPP_VITE_E2E_COMPILER_HOST ?? 'wv'
const route = '/pages/library/index'
let miniProgram: any

describe('e2e app: component library host', { concurrent: false }, () => {
  beforeAll(async () => {
    const require = createRequire(path.join(root, 'package.json'))
    const packageName = host === 'wv' ? 'weapp-vite' : host
    const cli = path.join(path.dirname(require.resolve(`${packageName}/package.json`)), host === 'wv' ? 'bin/weapp-vite.js' : host === 'vite-plus' ? 'bin/vp' : 'bin/vite.js')
    await rm(path.join(root, 'dist'), { recursive: true, force: true })
    for (const config of ['weapp-vite.runtime-lib.config.ts', 'weapp-vite.runtime.config.ts']) {
      await execa(process.execPath, [cli, 'build', '--config', config], { cwd: root })
    }
    for (const file of ['app.json', 'pages/library/index.js', 'pages/library/index.wxml', 'pages/library/index.json', 'library/native/index.js', 'library/native/index.json', 'library/native/index.wxml', 'library/native/index.d.ts', 'library/vue/index.js', 'library/vue/index.json', 'library/vue/index.wxml', 'library/vue/index.d.ts']) {
      await access(path.join(root, 'dist', file))
    }
    expect(await readFile(path.join(root, 'dist/library/native/index.d.ts'), 'utf8')).toContain('nativeLabel')
    miniProgram = await launchAutomator({ projectPath: root, warmupRoute: route, warmupRootSelectors: ['.library-host'], retryWarmupTimeout: true })
  }, 120_000)
  afterAll(async () => {
    await miniProgram?.close()
  })

  it('renders compiled native and Vue libraries and updates both component instances', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/lib-mode', [
      { id: 'library-mounted', route, action: '确认预编译原生与 Vue 组件挂载', nodes: [{ selector: '.library-host', text: 'Library consumer' }, { selector: '.native-count', scope: ['#native-counter'], text: '0' }, { selector: '.vue-count', scope: ['#vue-counter'], text: '0' }] },
      { id: 'library-clicked', route, action: '分别点击两个组件并确认更新', nodes: [{ selector: '.native-count', scope: ['#native-counter'], text: '1' }, { selector: '.vue-count', scope: ['#vue-counter'], text: '1' }] },
      { id: 'library-reentry', route, action: '重新进入页面确认库组件实例重建', nodes: [{ selector: '.native-count', scope: ['#native-counter'], text: '0' }, { selector: '.vue-count', scope: ['#vue-counter'], text: '0' }] },
    ])
    const collector = attachRuntimeErrorCollector(miniProgram)
    try {
      const page = await miniProgram.reLaunch(route)
      await dom.check('library-mounted', miniProgram, page)
      await (await (await page.$('#native-counter')).$('#native-increment')).tap()
      await (await (await page.$('#vue-counter')).$('#vue-increment')).tap()
      await dom.check('library-clicked', miniProgram, page)
      const second = await miniProgram.reLaunch(route)
      await dom.check('library-reentry', miniProgram, second)
      expect(collector.getSince(0)).toEqual([])
    }
    finally { collector.dispose() }
  })
})
