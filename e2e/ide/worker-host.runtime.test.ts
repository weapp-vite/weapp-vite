import { access } from 'node:fs/promises'
import { createRequire } from 'node:module'
// eslint-disable-next-line e18e/ban-dependencies -- 原生宿主构建需要跨平台进程启动。
import { execa } from 'execa'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const root = process.env.WEAPP_VITE_E2E_WORKER_PROJECT ?? path.resolve(import.meta.dirname, '../../e2e-apps/chunk-modes')
const host = process.env.WEAPP_VITE_E2E_COMPILER_HOST ?? 'wv'
const route = '/pages/worker/index'
let miniProgram: any

async function launch() {
  const require = createRequire(path.join(root, 'package.json'))
  const packageName = host === 'wv' ? 'weapp-vite' : host
  const cli = path.join(path.dirname(require.resolve(`${packageName}/package.json`)), host === 'wv' ? 'bin/weapp-vite.js' : host === 'vite-plus' ? 'bin/vp' : 'bin/vite.js')
  await execa(process.execPath, [cli, 'build', ...host === 'wv' ? [] : ['--config', 'vite.worker.config.mts']], { cwd: root })
  for (const file of ['app.json', 'pages/worker/index.js', 'pages/worker/index.wxml', 'pages/worker/index.json', 'workers/messages/index.js']) {
    await access(path.join(root, 'dist', file))
  }
  miniProgram = await launchAutomator({ projectPath: root, warmupRoute: route, warmupRootSelectors: ['.worker-message'], retryWarmupTimeout: true })
  return miniProgram
}

describe('e2e app: worker host', { concurrent: false }, () => {
  afterAll(async () => {
    await miniProgram?.close()
  })
  it('exchanges worker messages and resets worker state after page reentry', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/chunk-modes', [
      { id: 'worker-initial', route, action: '等待首条 worker 消息', nodes: [{ selector: '.worker-message', text: 'worker hello' }, { selector: '.worker-count', text: '0' }] },
      { id: 'worker-echo', route, action: '点击发送并确认消息复制及计数', nodes: [{ selector: '.worker-message', text: 'echo' }, { selector: '.worker-count', text: '1' }] },
      { id: 'worker-reentry', route, action: '重新进入页面并确认 worker 状态重置', nodes: [{ selector: '.worker-message', text: 'worker hello' }, { selector: '.worker-count', text: '0' }] },
    ])
    const app = await launch()
    const collector = attachRuntimeErrorCollector(app)
    try {
      const first = await app.reLaunch(route)
      await dom.check('worker-initial', app, first)
      await (await first.$('#worker-send')).tap()
      await dom.check('worker-echo', app, first)
      const second = await app.reLaunch(route)
      await dom.check('worker-reentry', app, second)
      expect(collector.getSince(0)).toEqual([])
    }
    finally { collector.dispose() }
  })
})
