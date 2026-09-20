/* eslint-disable no-console -- 探针原始观测写入 E2E 日志，供宿主行为对照。 */
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { startStreamProbeServer, streamPayload } from './streamProbe/server'
import { installStreamProbeTransport } from './streamProbe/transport'

const appRoot = path.resolve(import.meta.dirname, '../../e2e-apps/stream-capability-probe')
const route = '/pages/index/index'
const STREAM_SCENARIOS = ['normal', 'empty', 'abort-before', 'abort-after', 'disconnect', 'off-all', 'repeat'] as const
describe('native streaming capability probe', { concurrent: false }, () => {
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let disposeTransport: (() => void) | undefined
  let server: Awaited<ReturnType<typeof startStreamProbeServer>>
  beforeAll(async () => {
    const config = JSON.parse(await readFile(path.join(appRoot, 'project.config.json'), 'utf8')) as { appid: string }
    expect(config.appid).toMatch(/^wx[0-9a-f]{16}$/)
    await runWeappViteBuildWithLogCapture({ cliPath: path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js'), jsFormat: 'cjs', projectRoot: appRoot, platform: 'weapp', cwd: appRoot, label: 'ide:stream-probe' })
    for (const extension of ['js', 'json', 'wxml']) {
      await access(path.join(appRoot, `dist${route}.${extension}`))
    }
    server = await startStreamProbeServer()
    if (resolveRuntimeProviderName() === 'devtools') {
      await cleanupResidualIdeProcesses()
    }
    miniProgram = await launchAutomator({ projectPath: appRoot, warmupRoute: route, warmupRootSelectors: ['#stream-probe-root'], configureHeadlessSession(session) {
      disposeTransport = installStreamProbeTransport(session, server.baseUrl)
    } })
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
  it('records native capabilities without Web Runtime injection', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stream-capability-probe', [
      { id: 'initial', route, action: '原生探针首屏', nodes: [{ selector: '#probe-status', text: 'idle' }] },
    ])
    const page = await miniProgram!.reLaunch(route)
    await dom.check('initial', miniProgram!, page!)
    await page!.callMethod('probe')
    await expect.poll(() => page!.data('capabilitiesText')).not.toBe('')
    console.log('[stream-probe-capabilities]', JSON.stringify(await page!.data('capabilities')))
  })
  for (const scenario of STREAM_SCENARIOS) {
    it(`observes controlled network stages: ${scenario}`, { timeout: 30_000 }, async (ctx) => {
      const dom = createDomAcceptance(ctx, 'e2e-apps/stream-capability-probe', [
        { id: 'initial', route, action: '请求开始前', nodes: [{ selector: '#probe-status', text: 'idle' }] },
        { id: 'first-stage', route, action: '受控首阶段可见状态', nodes: [{ selector: '#probe-scenario', text: scenario }] },
        { id: 'terminal', route, action: '请求完成或取消', nodes: [{ selector: '#probe-status', text: 'completed' }] },
      ])
      const page = await miniProgram!.reLaunch(route)
      await dom.check('initial', miniProgram!, page!)
      await page!.callMethod('start', server.baseUrl, scenario, scenario)
      await expect.poll(() => server.requests.has(scenario), { timeout: 10_000 }).toBe(true)
      if (scenario === 'abort-before') {
        await dom.check('first-stage', miniProgram!, page!)
        await page!.callMethod('abort')
      }
      else if (scenario === 'empty') {
        await dom.check('first-stage', miniProgram!, page!)
        server.finish(scenario, true)
      }
      else {
        server.first(scenario)
        await expect.poll(() => page!.data('bytes'), { timeout: 10_000 }).toEqual(streamPayload.slice(0, 3))
        expect(server.requests.get(scenario)!.ended).toBe(false)
        await dom.check('first-stage', miniProgram!, page!)
        if (scenario !== 'abort-after') {
          expect(await page!.data('terminal')).toBe('')
          if (scenario === 'disconnect') {
            server.disconnect(scenario)
          }
          else {
            server.middle(scenario)
            if (scenario !== 'off-all') {
              await expect.poll(() => page!.data('bytes'), { timeout: 10_000 }).toEqual(streamPayload.slice(0, 7))
              expect(await page!.data('terminal')).toBe('')
            }
            server.finish(scenario)
          }
        }
      }
      await expect.poll(() => page!.data('status'), { timeout: 10_000 }).toBe('completed')
      const result = await page!.data()
      console.log('[stream-probe-result]', scenario, JSON.stringify(result))
      expect(result.removedCalls).toBe(0)
      expect(result.events.filter((event: string) => event === 'complete')).toHaveLength(1)
      expect(result.terminal).toBe(['abort-before', 'abort-after', 'disconnect'].includes(scenario) ? 'fail' : 'success')
      if (scenario === 'normal' || scenario === 'repeat') {
        expect(result.bytes).toEqual(streamPayload)
      }
      if (scenario === 'off-all' || scenario === 'abort-after' || scenario === 'disconnect') {
        expect(result.bytes).toEqual(streamPayload.slice(0, 3))
      }
      if (scenario === 'abort-before' || scenario === 'empty') {
        expect(result.bytes).toEqual([])
      }
      if (result.terminal === 'success') {
        expect(result).toMatchObject({ successDataType: 'string', successDataTag: '[object String]', successText: '', successBytes: [] })
      }
      expect(result.events.slice(-2)).toEqual([result.terminal, 'complete'])
      if (scenario === 'abort-before') {
        expect(result.events).toEqual(['fail', 'complete'])
      }
      else {
        expect(result.headerContentType).toBe('application/octet-stream')
        expect(result.events[0]).toBe('headers')
      }
      if (scenario.startsWith('abort')) {
        expect(result.error).toBe('request:fail abort')
        const closedAtAbort = server.requests.get(scenario)!.closed
        console.log('[stream-probe-cancel-transport]', scenario, JSON.stringify({ closedAtAbort }))
        if (!closedAtAbort) {
          if (scenario === 'abort-before') {
            server.first(scenario)
          }
          server.middle(scenario)
          server.finish(scenario)
        }
        await expect.poll(() => server.requests.get(scenario)!.closed, { timeout: 10_000 }).toBe(true)
        // 连接是否立即关闭属于宿主传输策略；晚到数据不能重新打开已终止的页面请求。
        expect(await page!.data('events')).toEqual(result.events)
        expect(await page!.data('bytes')).toEqual(result.bytes)
      }
      expect(Object.values(result.taskMethods)).toEqual(Array.from({ length: 5 }).fill('function'))
      await dom.check('terminal', miniProgram!, page!)
    })
  }
})
