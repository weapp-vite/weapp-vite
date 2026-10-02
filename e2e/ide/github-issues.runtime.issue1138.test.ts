import type { SetDataDebugInfo } from 'wevu'
import { ok as assert } from 'node:assert'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import { closeSharedMiniProgram, DIST_ROOT, getSharedMiniProgram, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT, prepareGithubIssuesBuild, relaunchPage } from './github-issues.runtime.shared'

describe('e2e app: github-issues / issue #1138', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    for (const name of ['index', 'delayed']) {
      for (const extension of ['js', 'json', 'wxml']) {
        expect(await fs.pathExists(path.join(DIST_ROOT, `pages/issue-1138/${name}.${extension}`))).toBe(true)
      }
    }
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)
  afterAll(() => closeSharedMiniProgram(), 30_000)

  it('correlates real native callback phases and separately checks visible updates', async (ctx) => {
    const route = '/pages/issue-1138/index'
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [0, 1, 2].map(count => ({
      id: `count-${count}`,
      route,
      action: `检查第 ${count} 次更新后的真实文本`,
      nodes: [{ selector: '#issue1138-count', text: `count: ${count}` }],
    })))
    const miniProgram = await getSharedMiniProgram(ctx)
    const page = await relaunchPage(miniProgram, route, undefined, 45_000, {
      readiness: async (target) => {
        await target.waitForRendered({ selector: '#issue1138-page', timeout: 5_000 })
        return true
      },
    })
    assert(page)
    await dom.check('count-0', miniProgram, page)
    await expect.poll(async () => (await page.callMethod('_readE2E')).at(-1)?.phase?.name).toBe('commit')
    await page.callMethod('_beginE2E')
    await dom.check('count-1', miniProgram, page)
    let events: SetDataDebugInfo[] = []
    await expect.poll(async () => {
      events = await page.callMethod('_readE2E')
      return events.filter(info => info.phase?.name === 'commit').length
    }).toBe(1)
    expect(events.map(info => info.phase?.name)).toEqual(['prepare', 'dispatch', 'commit'])
    expect(new Set(events.map(info => info.revision)).size).toBe(1)
    expect(events.at(-1)).toMatchObject({ phase: { result: 'committed', completion: 'callback', visibleAt: null } })
    expect(events.at(-1)?.phase?.dispatch?.payloadBytes).toBeGreaterThan(0)
    const button = await page.$('#issue1138-increment')
    assert(button)
    await button.tap()
    await dom.check('count-2', miniProgram, page)
  })

  it('keeps nextTick independent from a deliberately delayed adapter Promise', async (ctx) => {
    const route = '/pages/issue-1138/delayed'
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'native-visible',
      route,
      action: '适配器 Promise 尚未完成时独立检查宿主文本',
      nodes: [{ selector: '#issue1138-count', text: 'count: 1' }],
    }, {
      id: 'adapter-settled',
      route,
      action: '释放 Promise 后复核同一可见文本',
      nodes: [{ selector: '#issue1138-count', text: 'count: 1' }],
    }])
    const miniProgram = await getSharedMiniProgram(ctx)
    const page = await relaunchPage(miniProgram, route, undefined, 45_000, {
      readiness: async (target) => {
        await target.waitForRendered({ selector: '#issue1138-page', timeout: 5_000 })
        return true
      },
    })
    assert(page)
    await expect.poll(async () => (await page.callMethod('_readE2E')).events.some((info: SetDataDebugInfo) => info.phase?.name === 'commit')).toBe(true)
    await page.callMethod('_beginE2E')
    await expect.poll(async () => (await page.callMethod('_readE2E')).queueDrained).toBe(true)
    const result = await page.callMethod('_readE2E')
    expect(result.events.map((info: SetDataDebugInfo) => info.phase?.name)).toEqual(['prepare', 'dispatch'])
    await expect.poll(async () => (await page.callMethod('_readE2E')).nativeCallbackCompleted).toBe(true)
    await dom.check('native-visible', miniProgram, page)
    await page.callMethod('_releaseE2E')
    await expect.poll(async () => (await page.callMethod('_readE2E')).events.at(-1)?.phase?.name).toBe('commit')
    const { events }: { events: SetDataDebugInfo[] } = await page.callMethod('_readE2E')
    expect(events.at(-1)).toMatchObject({ phase: { name: 'commit', result: 'committed', completion: 'promise', visibleAt: null } })
    await dom.check('adapter-settled', miniProgram, page)
  })
})
