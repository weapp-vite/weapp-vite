import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { ok as assert } from 'node:assert'
import process from 'node:process'
import { HEADLESS_PROTOCOL_UNSUPPORTED } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator, reconnectAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { getManagedProjectSessionOwner } from '../utils/managedProjectSession'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { APP_ROOT, DIST_ROOT, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT, prepareGithubIssuesBuild } from './github-issues.runtime.shared'

const ROUTE = '/pages/issue-1234/index'
const TOUCH_ID = 'issue-1234-touch'
const touch = { identifier: 7, pageX: 42, pageY: 64, clientX: 42, clientY: 64 }
const moved = { identifier: 7, pageX: 48, pageY: 80, clientX: 48, clientY: 80 }

describe('issue #1234: upstream automator 0.13 public capabilities', { concurrent: false }, () => {
  let miniProgram: MiniProgram | undefined

  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    for (const extension of ['js', 'json', 'wxml']) {
      expect(await fs.pathExists(path.join(DIST_ROOT, `pages/issue-1234/index.${extension}`))).toBe(true)
    }
    const app = await fs.readJSON(path.join(DIST_ROOT, 'app.json')) as { pages: string[] }
    expect(app.pages).toContain('pages/issue-1234/index')
    miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      bridgeProjectMode: 'direct',
      warmupRoute: ROUTE,
      warmupRootSelectors: ['#issue-1234-page'],
    })
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT + 120_000)

  afterAll(async () => {
    await miniProgram?.close()
  }, 30_000)

  it('exposes protocols, forwards touches, unsubscribes CDP and reconnects the same owned window', async (context) => {
    assert(miniProgram)
    const headless = resolveRuntimeProviderName() === 'headless'
    const expected = [
      { type: 'touchstart', touches: [touch], changedTouches: [touch], target: TOUCH_ID, currentTarget: TOUCH_ID },
      { type: 'touchmove', touches: [moved], changedTouches: [moved], target: TOUCH_ID, currentTarget: TOUCH_ID },
      { type: 'touchend', touches: [], changedTouches: [moved], target: TOUCH_ID, currentTarget: TOUCH_ID },
      { type: 'touchstart', touches: [touch], changedTouches: [touch], target: TOUCH_ID, currentTarget: TOUCH_ID },
    ]
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues', [
      { id: 'initial', route: ROUTE, action: '公开协议读取原生触摸页面', nodes: [{ selector: '#issue-1234-events', text: '[]' }] },
      { id: 'touches', route: ROUTE, action: '触摸与 dispatchEvent 更新原生页面及渲染文本', nodes: [{ selector: '#issue-1234-events', text: JSON.stringify(expected) }] },
      { id: 'final', route: ROUTE, action: '调试能力探测与连接边界后保留原生页面状态', nodes: [{ selector: '#issue-1234-events', text: JSON.stringify(expected) }] },
    ])
    const page = await miniProgram.reLaunch(ROUTE)
    await dom.check('initial', miniProgram, page)
    const info = await miniProgram.send('Tool.getInfo', {}, { timeout: 5_000 })
    expect(info).toEqual(expect.any(Object))
    process.stdout.write(`[issue-1234 runtime] devtools=${info.version ?? '<headless>'} baseLibrary=${info.SDKVersion ?? '<unknown>'}\n`)
    expect(await miniProgram.send('App.getCurrentPage')).toMatchObject({ path: ROUTE.slice(1) })
    expect(await miniProgram.send('App.getPageStack')).toMatchObject({ pageStack: [expect.objectContaining({ path: ROUTE.slice(1) })] })
    expect(await miniProgram.send('App.callFunction', { functionDeclaration: '(value) => value + 1', args: [41] })).toEqual({ result: 42 })
    const systemInfo = await miniProgram.send('App.callWxMethod', { method: 'getSystemInfoSync', args: [] })
    expect(systemInfo.result).toMatchObject({ platform: expect.any(String) })

    const surface = await page.$(`#${TOUCH_ID}`)
    assert(surface, 'Expected native touch surface')
    await surface.touchstart({ touches: [touch], changedTouches: [touch] })
    await surface.touchmove({ touches: [moved], changeTouches: [moved] })
    await surface.touchend({ touches: [], changedTouches: [moved] })
    await surface.dispatchEvent({ eventName: 'touchstart', touches: [touch], changedTouches: [touch], changeTouches: [moved] })
    await expect.poll(() => page.data('events')).toEqual(expected)
    await dom.check('touches', miniProgram, page)

    const cdp = miniProgram.CDP()
    if (headless) {
      await expect(cdp.enable()).rejects.toMatchObject({ code: HEADLESS_PROTOCOL_UNSUPPORTED })
      await expect(cdp.listProtocol()).rejects.toMatchObject({ code: HEADLESS_PROTOCOL_UNSUPPORTED })
      await expect(cdp.sendCommand('Runtime', 'enable')).rejects.toMatchObject({ code: HEADLESS_PROTOCOL_UNSUPPORTED })
      expect(() => cdp.onEvent(() => {})).toThrow(expect.objectContaining({ code: HEADLESS_PROTOCOL_UNSUPPORTED }))
      await expect(miniProgram.send('Tool.unsupported')).rejects.toMatchObject({ code: HEADLESS_PROTOCOL_UNSUPPORTED })
      await dom.check('final', miniProgram, page)
      const disconnecting = miniProgram.disconnect()
      expect(disconnecting).toBeInstanceOf(Promise)
      await disconnecting
      await expect(miniProgram.send('Tool.getInfo')).rejects.toThrow(/closed/i)
      return
    }

    await Promise.all([cdp.enable(), miniProgram.CDP().enable()])
    const protocol = await cdp.listProtocol()
    expect(protocol).toEqual(expect.any(Object))
    expect(JSON.stringify(protocol)).toContain('Runtime')
    await cdp.sendCommand('Runtime', 'enable')
    const received: unknown[] = []
    const unsubscribe = cdp.onEvent((domain, event, params) => {
      if (domain === 'Runtime' && event === 'consoleAPICalled') {
        received.push(params)
      }
    })
    try {
      const evaluation = await cdp.sendCommand('Runtime', 'evaluate', { expression: '40 + 2', returnByValue: true })
      expect(evaluation).toMatchObject({ result: { value: 42 } })
      // eslint-disable-next-line no-console -- 验证真实 AppService 的 CDP console 事件。
      await miniProgram.evaluate(() => console.log('issue-1234-cdp-event'))
      await expect.poll(() => JSON.stringify(received)).toContain('issue-1234-cdp-event')
      unsubscribe()
      const count = received.length
      // eslint-disable-next-line no-console -- 验证取消订阅后真实事件不再交给监听者。
      await miniProgram.evaluate(() => console.log('issue-1234-cdp-unsubscribed'))
      // 后续命令回执形成事件处理屏障，不依赖固定等待。
      await cdp.sendCommand('Runtime', 'evaluate', { expression: '42', returnByValue: true })
      expect(received).toHaveLength(count)
    }
    finally {
      unsubscribe()
    }
    const previous = miniProgram
    const owner = getManagedProjectSessionOwner(previous)
    const metadata: unknown = Reflect.get(previous, '__WEAPP_VITE_SESSION_METADATA')
    assert(owner, 'Expected an owned direct IDE session')
    const disconnecting = previous.disconnect()
    expect(disconnecting).toBeInstanceOf(Promise)
    await disconnecting
    await expect(previous.send('Tool.getInfo')).rejects.toThrow(/closed/i)
    miniProgram = await reconnectAutomator(previous)
    expect(getManagedProjectSessionOwner(miniProgram)).toBe(owner)
    expect(Reflect.get(miniProgram, '__WEAPP_VITE_SESSION_METADATA')).toEqual(metadata)
    expect(await (await miniProgram.currentPage()).data('events')).toEqual(expected)
    await dom.check('final', miniProgram, await miniProgram.currentPage())
  }, 90_000)
})
