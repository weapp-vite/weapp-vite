import { ok as assert } from 'node:assert'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import {
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

const LAUNCH_ROUTE = '/pages/issue-1049/index'
const RESULT_ROUTE = '/pages/issue-1049/result/index'

describe('e2e app: github-issues / issue #1049', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    for (const route of [LAUNCH_ROUTE, RESULT_ROUTE]) {
      for (const extension of ['js', 'json', 'wxml']) {
        expect(await fs.pathExists(path.join(DIST_ROOT, `${route.slice(1)}.${extension}`))).toBe(true)
      }
    }
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  }, 30_000)

  it('preserves nested patch, shallow state and plugin initialization boundaries', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'boundaries',
      route: RESULT_ROUTE,
      action: '嵌套 patch、浅层状态与插件初始化后渲染通知计数',
      nodes: [{ selector: '#issue1049-boundaries', text: 'patch:3 shallow:2 plugin:1' }],
    }])
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const page = await relaunchPage(miniProgram, RESULT_ROUTE)
      assert(page)
      await page.callMethod('_boundaries')
      await expect.poll(() => page.callMethod('_boundarySnapshot')).toEqual({
        patch: ['patch object:2', 'patch function:3', 'direct:4'],
        pluginDuring: [],
        pluginSync: ['direct:3'],
        pluginAsync: ['direct:1', 'direct:3'],
        identity: true,
        rawNested: true,
        shallowDuring: [],
        shallowEvents: ['direct', 'direct'],
        values: [5, 6],
        summary: 'patch:3 shallow:2 plugin:1',
      })
      await dom.check('boundaries', miniProgram, page)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('unsubscribes page and child scopes on reLaunch, retaining shared computed and in-flight actions', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'initial',
      route: LAUNCH_ROUTE,
      action: '页面和子组件注册订阅',
      nodes: [{ selector: '#issue1049-count', text: '0' }, { selector: '#issue1049-child', scope: ['#issue1049-subscriber'], text: 'child subscribed' }],
    }, {
      id: 'result',
      route: RESULT_ROUTE,
      action: '创建页面卸载后继续更新共享 Store',
      nodes: [{ selector: '#issue1049-count', text: '2' }, { selector: '#issue1049-double', text: '4' }],
    }])
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const preparation = await relaunchPage(miniProgram, RESULT_ROUTE)
      assert(preparation)
      await preparation.callMethod('_resetScenario')
      const page = await relaunchPage(miniProgram, LAUNCH_ROUTE)
      assert(page)
      await dom.check('initial', miniProgram, page)
      expect(await page.callMethod('_mutate')).toMatchObject({ count: 1, page: 1, child: 1, detached: 1 })
      await page.callMethod('_startActions')
      const result = await relaunchPage(miniProgram, RESULT_ROUTE)
      assert(result)
      await result.waitForRendered({ selector: '#issue1049-result', timeout: 5000 })
      expect(await result.callMethod('_mutate')).toMatchObject({
        count: 2,
        doubled: 4,
        page: 1,
        child: 1,
        detached: 2,
        actions: 3,
        detachedActions: 4,
        unloaded: 1,
        cleanup: 0,
      })
      await result.callMethod('_finish')
      await expect.poll(() => result.callMethod('_snapshot')).toMatchObject({ after: 1, errors: 1 })
      await dom.check('result', miniProgram, result)
      expect(await result.callMethod('_dispose')).toEqual({ different: true, retained: 2, same: true, fresh: 0 })
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('keeps hidden page subscriptions and releases only an unmounted child', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'child-removed',
      route: LAUNCH_ROUTE,
      action: '卸载子组件后更新 Store',
      nodes: [{ selector: '#issue1049-count', text: '1' }, { selector: '#issue1049-double', text: '2' }],
    }, {
      id: 'hidden-page',
      route: RESULT_ROUTE,
      action: 'navigateTo 只隐藏页面，保留页面订阅',
      nodes: [{ selector: '#issue1049-count', text: '2' }, { selector: '#issue1049-double', text: '4' }],
    }])
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const preparation = await relaunchPage(miniProgram, RESULT_ROUTE)
      assert(preparation)
      await preparation.callMethod('_resetScenario')
      const page = await relaunchPage(miniProgram, LAUNCH_ROUTE)
      assert(page)
      await page.callMethod('_removeChild')
      await expect.poll(() => page.$('#issue1049-subscriber')).toBeNull()
      expect(await page.callMethod('_mutate')).toMatchObject({ count: 1, page: 1, child: 0, detached: 1 })
      await dom.check('child-removed', miniProgram, page)
      const result = await miniProgram.navigateTo(RESULT_ROUTE)
      assert(result)
      await result.waitForRendered({ selector: '#issue1049-result', timeout: 5000 })
      expect(await result.callMethod('_mutate')).toMatchObject({
        count: 2,
        page: 2,
        child: 0,
        detached: 2,
        hidden: 1,
        unloaded: 0,
      })
      await dom.check('hidden-page', miniProgram, result)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
