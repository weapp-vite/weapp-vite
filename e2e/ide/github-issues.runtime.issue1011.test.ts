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
  tapElement,
} from './github-issues.runtime.shared'

const ISSUE_ROUTE = '/pages/issue-1011/index'

interface Issue1011Snapshot {
  objectCaptures: Array<{
    id: string
    label: unknown
    rest: Record<string, unknown>
    restKeys: string[]
    rowIndex: number
    sectionName: string
  }>
  tupleCaptures: Array<{
    head: string
    tail: string[]
    tupleIndex: number
  }>
}

describe('e2e app: github-issues / issue #1011', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    for (const relativePath of [
      'pages/issue-1011/index.js',
      'pages/issue-1011/index.json',
      'pages/issue-1011/index.wxml',
    ]) {
      await expect(fs.pathExists(path.join(DIST_ROOT, relativePath))).resolves.toBe(true)
    }
    const appConfig = await fs.readJSON(path.join(DIST_ROOT, 'app.json')) as { pages: string[] }
    expect(appConfig.pages).toContain(ISSUE_ROUTE.slice(1))
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  }, 30_000)

  it('keeps destructuring semantics equal between rendered and event values', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'initial',
      route: ISSUE_ROUTE,
      action: '检查默认值、对象 rest 排除与数组 rest 首屏结果',
      nodes: [
        { selector: '#issue1011-value-missing', text: 'missing|section-fallback|A|excluded|excluded' },
        { selector: '#issue1011-value-null', text: 'null|null|B|excluded|excluded' },
        { selector: '#issue1011-value-zero', text: 'zero|0|C|excluded|excluded' },
        { selector: '#issue1011-value-false', text: 'false|false|D|excluded|excluded' },
        { selector: '#issue1011-tuple-0', text: 'head|tail-a|tail-b' },
        { selector: '#issue1011-capture-count', text: '0' },
      ],
    }, {
      id: 'captured',
      route: ISSUE_ROUTE,
      action: '逐项触发事件并检查 resolver 与插值值一致',
      nodes: [
        { selector: '#issue1011-capture-count', text: '5' },
      ],
    }])
    const miniProgram = await getSharedMiniProgram(ctx)
    const page = await relaunchPage(miniProgram, ISSUE_ROUTE, undefined, 45_000, {
      readiness: async (targetPage) => {
        await targetPage.waitForRendered({ selector: '#issue-1011-page', timeout: 5_000 })
        return true
      },
    })
    assert(page, 'Expected issue-1011 page')
    await dom.check('initial', miniProgram, page)

    for (const id of ['missing', 'null', 'zero', 'false']) {
      await tapElement(page, `#issue1011-action-${id}`)
    }
    await tapElement(page, '#issue1011-tuple-0')

    await expect.poll(
      async () => await page.callMethodWithOptions('_snapshot', { timeout: 5_000 }) as Issue1011Snapshot,
      { timeout: 10_000 },
    ).toEqual({
      objectCaptures: [
        {
          id: 'missing',
          label: 'section-fallback',
          rest: { extra: 'A' },
          restKeys: ['extra'],
          rowIndex: 0,
          sectionName: 'section-fallback',
        },
        {
          id: 'null',
          label: null,
          rest: { extra: 'B' },
          restKeys: ['extra'],
          rowIndex: 1,
          sectionName: 'section-fallback',
        },
        {
          id: 'zero',
          label: 0,
          rest: { extra: 'C' },
          restKeys: ['extra'],
          rowIndex: 2,
          sectionName: 'section-fallback',
        },
        {
          id: 'false',
          label: false,
          rest: { extra: 'D' },
          restKeys: ['extra'],
          rowIndex: 3,
          sectionName: 'section-fallback',
        },
      ],
      tupleCaptures: [{
        head: 'head',
        tail: ['tail-a', 'tail-b'],
        tupleIndex: 0,
      }],
    })
    await dom.check('captured', miniProgram, page)
  })
})
