/* eslint-disable no-console -- 保留真实宿主能力与成功路径是否执行的观测证据。 */
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { startSseServer } from './streamProbe/sseServer'
import { installStreamProbeTransport } from './streamProbe/transport'

const appRoot = path.resolve(import.meta.dirname, '../../e2e-apps/stream-capability-probe')
const route = '/pages/sse/index'
const nativeRoute = '/pages/index/index'

describe('standard Fetch and EventSource streaming', { concurrent: false }, () => {
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let disposeTransport: (() => void) | undefined
  let server: Awaited<ReturnType<typeof startSseServer>>
  let hasEarlyStatus = false

  async function waitForRequest(id: string, page: { data: () => Promise<unknown> }) {
    try {
      await expect.poll(() => server.requests.has(id)).toBe(true)
    }
    catch (error) {
      console.log('[sse-request-failure]', JSON.stringify({ id, page: await page.data() }))
      throw error
    }
  }

  beforeAll(async () => {
    const config = JSON.parse(await readFile(path.join(appRoot, 'project.config.json'), 'utf8')) as { appid: string }
    expect(config.appid).toMatch(/^wx[0-9a-f]{16}$/)
    await runWeappViteBuildWithLogCapture({ cliPath: path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js'), configFile: 'weapp-vite.sse.config.ts', jsFormat: 'cjs', projectRoot: appRoot, platform: 'weapp', cwd: appRoot, label: 'ide:sse-stream' })
    const app = JSON.parse(await readFile(path.join(appRoot, 'dist/app.json'), 'utf8')) as { pages: string[] }
    expect(app.pages).toEqual(['pages/index/index', 'pages/sse/index'])
    for (const page of [route, nativeRoute]) {
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(appRoot, `dist${page}.${extension}`))
      }
    }
    server = await startSseServer()
    if (resolveRuntimeProviderName() === 'devtools') {
      await cleanupResidualIdeProcesses()
    }
    miniProgram = await launchAutomator({ projectPath: appRoot, warmupRoute: nativeRoute, warmupRootSelectors: ['#stream-probe-root'], configureHeadlessSession(session) {
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

  it('records early metadata from the native request callbacks', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stream-capability-probe', [
      { id: 'initial', route: nativeRoute, action: '原生元数据探针首屏', nodes: [{ selector: '#probe-status', text: 'idle' }] },
      { id: 'headers', route: nativeRoute, action: '提前到达的原生响应头', nodes: [{ selector: '#probe-scenario', text: 'sse-metadata' }] },
      { id: 'terminal', route: nativeRoute, action: '原生请求结束', nodes: [{ selector: '#probe-status', text: 'completed' }] },
    ])
    const page = await miniProgram!.reLaunch(nativeRoute)
    await dom.check('initial', miniProgram!, page!)
    await page!.callMethod('start', server.baseUrl, 'sse-metadata', 'sse-metadata')
    await expect.poll(() => server.requests.has('sse-metadata')).toBe(true)
    server.headers('sse-metadata')
    await expect.poll(() => page!.data('headerKeys')).not.toEqual([])
    const earlyStatus = await page!.data('headerStatus') as number | null
    // SSE 配置已安装全局兼容层；这里只观察 wx.request 回调，不冒充未注入的宿主能力探针。
    hasEarlyStatus = earlyStatus === 200
    expect([null, 200]).toContain(earlyStatus)
    expect(server.requests.get('sse-metadata')![0]!.ended).toBe(false)
    console.log('[sse-runtime-capability]', JSON.stringify({ provider: resolveRuntimeProviderName(), earlyStatus, earlyStatusAvailable: hasEarlyStatus }))
    await dom.check('headers', miniProgram!, page!)
    server.finish('sse-metadata')
    await expect.poll(() => page!.data('status')).toBe('completed')
    await dom.check('terminal', miniProgram!, page!)
  })

  it('streams authenticated POST through a real parser, or explicitly refuses missing metadata', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stream-capability-probe', [
      { id: 'initial', route, action: 'Fetch SSE 首屏', nodes: [{ selector: '#sse-status', text: 'idle' }] },
      { id: 'first', route, action: '首条事件或明确的宿主能力错误', nodes: [{ selector: hasEarlyStatus ? '#sse-text' : '#sse-error', text: hasEarlyStatus ? '中文😀' : 'NotSupportedError' }] },
      { id: 'terminal', route, action: 'Fetch 终态', nodes: [{ selector: '#sse-status', text: hasEarlyStatus ? 'completed' : 'error' }] },
    ])
    const page = await miniProgram!.reLaunch(route)
    await dom.check('initial', miniProgram!, page!)
    await page!.callMethod('startFetch', server.baseUrl, 'fetch')
    await waitForRequest('fetch', page!)
    const request = server.requests.get('fetch')![0]!
    expect(request.request.method).toBe('POST')
    expect(request.request.headers.authorization).toBe('Bearer fixture-auth')
    expect(JSON.parse(request.body)).toEqual({ prompt: '中文流式回复' })
    server.headers('fetch')
    if (hasEarlyStatus) {
      server.write('fetch', 'data: 中文😀\n\n')
      await expect.poll(() => page!.data('text')).toBe('中文😀')
      expect(request.ended).toBe(false)
      expect(await page!.data('status')).toBe('streaming')
      expect(await page!.data('httpStatus')).toBe(200)
      await dom.check('first', miniProgram!, page!)
      server.write('fetch', 'data: 完成\n\n')
      server.finish('fetch')
      await expect.poll(() => page!.data('status')).toBe('completed')
      expect(await page!.data('messages')).toEqual(['中文😀', '完成'])
      console.log('[sse-fetch-success]', JSON.stringify({ successPathExecuted: true }))
    }
    else {
      await expect.poll(() => page!.data('errorName')).toBe('NotSupportedError')
      expect(await page!.data('httpStatus')).toBe(null)
      console.log('[sse-fetch-success]', JSON.stringify({ successPathExecuted: false, reason: 'missing-early-status' }))
      await dom.check('first', miniProgram!, page!)
      server.finish('fetch')
    }
    await dom.check('terminal', miniProgram!, page!)
  })

  it('reconnects EventSource with Last-Event-ID, or closes on unsupported metadata', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stream-capability-probe', [
      { id: 'initial', route, action: 'EventSource 首屏', nodes: [{ selector: '#sse-status', text: 'idle' }] },
      { id: 'first', route, action: '首条消息或不可重试的能力错误', nodes: [{ selector: hasEarlyStatus ? '#sse-text' : '#sse-status', text: hasEarlyStatus ? '第一条' : 'closed' }] },
      { id: 'terminal', route, action: '重连消息或永久关闭状态', nodes: [{ selector: hasEarlyStatus ? '#sse-text' : '#sse-source-state', text: hasEarlyStatus ? '第一条第二条' : '2' }] },
    ])
    const page = await miniProgram!.reLaunch(route)
    await dom.check('initial', miniProgram!, page!)
    await page!.callMethod('startEventSource', server.baseUrl, 'events')
    await expect.poll(() => server.requests.has('events')).toBe(true)
    server.headers('events')
    if (hasEarlyStatus) {
      server.write('events', 'retry: 10\nid: resume\ndata: 第一条\n\n')
      await expect.poll(() => page!.data('text')).toBe('第一条')
      expect(server.requests.get('events')![0]!.ended).toBe(false)
      await dom.check('first', miniProgram!, page!)
      server.disconnect('events')
      await expect.poll(() => server.requests.get('events')?.length).toBe(2)
      expect(server.requests.get('events')![1]!.request.headers['last-event-id']).toBe('resume')
      server.headers('events', 1)
      server.write('events', 'data: 第二条\n\n', 1)
      await expect.poll(() => page!.data('text')).toBe('第一条第二条')
      expect(await page!.data('lastEventIds')).toEqual(['resume', 'resume'])
    }
    else {
      await expect.poll(() => page!.data('status')).toBe('closed')
      expect(await page!.data('sourceState')).toBe(2)
      expect(server.requests.get('events')).toHaveLength(1)
      await dom.check('first', miniProgram!, page!)
      server.finish('events')
    }
    await dom.check('terminal', miniProgram!, page!)
    await page!.callMethod('stop')
  })

  it('aborts a pending or streaming Fetch on page unload without late data', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stream-capability-probe', [
      { id: 'initial', route, action: '卸载测试首屏', nodes: [{ selector: '#sse-status', text: 'idle' }] },
      { id: 'before-unload', route, action: '卸载前请求处于活动状态', nodes: [{ selector: '#sse-status', text: hasEarlyStatus ? 'streaming' : 'waiting' }] },
      { id: 'unloaded', route: nativeRoute, action: '卸载后原生页可用', nodes: [{ selector: '#probe-status', text: 'idle' }] },
    ])
    const page = await miniProgram!.reLaunch(route)
    await dom.check('initial', miniProgram!, page!)
    await page!.callMethod('startFetch', server.baseUrl, 'unload')
    await waitForRequest('unload', page!)
    if (hasEarlyStatus) {
      server.headers('unload')
      server.write('unload', 'data: 卸载前\n\n')
      await expect.poll(() => page!.data('text')).toBe('卸载前')
    }
    await dom.check('before-unload', miniProgram!, page!)
    const nativePage = await miniProgram!.reLaunch(nativeRoute)
    await dom.check('unloaded', miniProgram!, nativePage!)
    const state = server.requests.get('unload')![0]!
    if (!state.closed) {
      server.write('unload', 'data: 晚到数据\n\n')
      server.finish('unload')
    }
    await expect.poll(() => state.closed).toBe(true)
    expect(await nativePage!.callMethod('readSseUnload')).toMatchObject({ closed: true, abortRequested: true, lateCallbacks: 0, messages: hasEarlyStatus ? ['卸载前'] : [] })
  })

  it.runIf(resolveRuntimeProviderName() === 'headless')('rejects a host response without early status instead of assuming HTTP 200', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/stream-capability-probe', [
      { id: 'initial', route, action: '缺失状态码回归首屏', nodes: [{ selector: '#sse-status', text: 'idle' }] },
      { id: 'error', route, action: '缺失元数据明确失败', nodes: [{ selector: '#sse-error', text: 'NotSupportedError' }] },
    ])
    const page = await miniProgram!.reLaunch(route)
    await dom.check('initial', miniProgram!, page!)
    await page!.callMethod('startFetch', server.baseUrl, 'missing-status', true)
    await expect.poll(() => server.requests.has('missing-status')).toBe(true)
    server.headers('missing-status')
    await expect.poll(() => page!.data('errorName')).toBe('NotSupportedError')
    expect(await page!.data('httpStatus')).toBe(null)
    expect(await page!.data('messages')).toEqual([])
    await dom.check('error', miniProgram!, page!)
    server.finish('missing-status')
  })
})
