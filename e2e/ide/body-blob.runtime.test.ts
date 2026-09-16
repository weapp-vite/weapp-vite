import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { startRequestClientsRealServer } from '../utils/requestClientsRealServer'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { installBodyBlobTransport } from './bodyBlob/transport'

const appRoot = path.resolve(import.meta.dirname, '../../e2e-apps/request-clients-real-native')
const route = '/pages/body-blob/index'
const ids = ['response-consume', 'concurrent-read', 'clone', 'null-body', 'empty-body', 'request-read', 'blob-size', 'blob-snapshot', 'blob-slice', 'blob-mime', 'headers-callback', 'fetch-consume']

describe('issue #1030 Body/Blob runtime contracts', { concurrent: false }, () => {
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let server: Awaited<ReturnType<typeof startRequestClientsRealServer>> | undefined
  let disposeTransport: (() => void) | undefined

  beforeAll(async () => {
    const config = JSON.parse(await readFile(path.join(appRoot, 'project.config.json'), 'utf8')) as { appid?: string }
    expect(config.appid).toMatch(/^wx[0-9a-f]{16}$/)
    await runWeappViteBuildWithLogCapture({
      cliPath: path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js'),
      jsFormat: 'cjs',
      projectRoot: appRoot,
      platform: 'weapp',
      cwd: appRoot,
      label: 'ide:body-blob',
    })
    for (const extension of ['js', 'json', 'wxml']) {
      await access(path.join(appRoot, `dist${route}.${extension}`))
    }
    server = await startRequestClientsRealServer()
    if (resolveRuntimeProviderName() === 'devtools') {
      await cleanupResidualIdeProcesses()
    }
    miniProgram = await launchAutomator({
      projectPath: appRoot,
      warmupRoute: '/pages/index/index',
      warmupRootSelectors: ['#request-clients-real-root', '#body-blob-route'],
      retryWarmupTimeout: true,
      // 页面切换后由下方精确的 DOM checkpoint 验证就绪，不复用首页 warmup 选择器。
      skipRelaunchPageRootCheck: true,
      configureHeadlessSession(session) {
        disposeTransport = installBodyBlobTransport(session, server!.baseUrl)
      },
    })
  }, 360_000)

  afterAll(async () => {
    try {
      disposeTransport?.()
      await miniProgram?.close()
    }
    finally {
      await server?.stop()
    }
  })

  it('renders each contract result and consumes a real HTTP response exactly once', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/request-clients-real-native', [
      { id: 'initial', route, action: '契约页初始状态', nodes: [{ selector: '#body-blob-status', text: 'idle' }] },
      { id: 'completed', route, action: '执行本地契约和真实 fetch 后检查逐项结果', nodes: [
        { selector: '#body-blob-status', text: 'passed' },
        ...ids.map(id => ({ selector: `#contract-${id}`, text: 'passed' })),
      ] },
      { id: 'repeated', route, action: '同一会话再次执行，确认没有共享的消费状态残留', nodes: [
        { selector: '#body-blob-status', text: 'passed' },
        ...ids.map(id => ({ selector: `#contract-${id}`, text: 'passed' })),
      ] },
    ])
    const page = await miniProgram!.reLaunch(`${route}?baseUrl=${encodeURIComponent(server!.baseUrl)}`)
    expect(page).toBeTruthy()
    await dom.check('initial', miniProgram!, page!)
    for (const checkpoint of ['completed', 'repeated']) {
      await page!.callMethod('runE2E')
      await expect.poll(async () => await page!.data('status'), { timeout: 15_000 }).not.toMatch(/^(idle|running)$/)
      const result = await page!.data()
      expect(result, JSON.stringify(result)).toMatchObject({ status: 'passed' })
      await dom.check(checkpoint, miniProgram!, page!)
    }
    expect(server!.requestCounts.fetch).toBe(2)
  }, 120_000)
})
