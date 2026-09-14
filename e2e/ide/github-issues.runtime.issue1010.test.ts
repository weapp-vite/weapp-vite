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

const ISSUE_ROUTE = '/pages/issue-1010/index'
// 普通 setup let 写入会更新闭包，但不会单独触发渲染；后续 ref 更新触发时才会带出最新值。
const STEPS = [
  {
    id: 'reported',
    control: '#issue-1010-reported',
    node: '#issue-1010-count',
    text: '1',
    expected: { count: 2 },
  },
  {
    id: 'object',
    control: '#issue-1010-object',
    node: '#issue-1010-object-state',
    text: '3|7|4|5|2|6',
    expected: {
      aliasCount: 3,
      defaultCount: 7,
      nestedCount: 4,
      refCount: 5,
      objectRest: { count: 2, extra: 6 },
    },
  },
  {
    id: 'array',
    control: '#issue-1010-array',
    node: '#issue-1010-array-state',
    text: '8|7|9|10|11',
    expected: {
      arrayCount: 8,
      arrayDefault: 7,
      arrayRef: 9,
      arrayRest: [10, 11],
    },
  },
  {
    id: 'local',
    control: '#issue-1010-local',
    node: '#issue-1010-local-state',
    text: '0|2',
    expected: { count: 2, localResult: 12 },
  },
  {
    id: 'order',
    control: '#issue-1010-order',
    node: '#issue-1010-order-state',
    text: '14|13|key|source|default|rest',
    expected: {
      orderedCount: 14,
      orderedRest: { extra: 13 },
      evaluationOrder: ['key', 'source', 'default', 'rest'],
    },
  },
  {
    id: 'direct',
    control: '#issue-1010-direct',
    node: '#issue-1010-direct-state',
    text: '2|2',
    expected: { directCount: 2, directRef: 2 },
  },
] as const

describe('e2e app: github-issues / issue #1010', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    for (const relativePath of [
      'pages/issue-1010/index.js',
      'pages/issue-1010/index.json',
      'pages/issue-1010/index.wxml',
    ]) {
      await expect(fs.pathExists(path.join(DIST_ROOT, relativePath))).resolves.toBe(true)
    }
    const appJson = await fs.readJSON(path.join(DIST_ROOT, 'app.json')) as { pages?: string[] }
    expect(appJson.pages).toContain(ISSUE_ROUTE.slice(1))
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('writes recursive destructuring targets without globals or shadow leaks', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [
      {
        id: 'initial',
        route: ISSUE_ROUTE,
        action: '检查解构赋值前的组件状态',
        nodes: [{ selector: '#issue-1010-count', text: '1' }],
      },
      ...STEPS.map(step => ({
        id: step.id,
        route: ISSUE_ROUTE,
        action: `执行 ${step.id} 解构写入并检查渲染状态`,
        nodes: [{ selector: step.node, text: step.text }],
      })),
    ])
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const page = await relaunchPage(miniProgram, ISSUE_ROUTE, undefined, 30_000, {
        readiness: async (targetPage) => {
          await targetPage.waitForRendered({ selector: '#issue-1010-root', timeout: 5_000 })
          return true
        },
      })
      if (!page) {
        throw new Error('Failed to launch issue-1010 page')
      }

      await dom.check('initial', miniProgram, page)
      expect(await page.callMethod('_runE2E')).toMatchObject({
        count: 1,
        refCount: 0,
        arrayRef: 0,
        directCount: 1,
        directRef: 1,
      })

      for (const step of STEPS) {
        const controls = await page.$$(step.control, { fallback: false, timeout: 5_000 })
        expect(controls).toHaveLength(1)
        await controls[0].tap()
        // tap 的协议响应早于 AppService 事件完成；只等待状态，不重复点击。
        await expect.poll(async () => await page.callMethod('_runE2E'), { timeout: 5_000 })
          .toMatchObject(step.expected)
        await dom.check(step.id, miniProgram, page)
      }

      const runtimeErrors = miniProgram?.__weappViteRuntimeLogMeta?.entries
        ?.filter((entry: { level?: string }) => entry.level === 'error' || entry.level === 'exception')
        ?? []
      expect(runtimeErrors).toEqual([])
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
