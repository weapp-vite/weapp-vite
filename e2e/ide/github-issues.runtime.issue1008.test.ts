import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import {
  callRoutePageMethod,
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

const ISSUE_1008_ROUTE = '/pages/issue-1008/index'

interface Issue1008Snapshot {
  blockResult: number[]
  closureResult: number[]
  count: number
  parameterResult: number[]
}

interface Issue1008Step {
  button?: string
  id: string
  snapshot: Issue1008Snapshot
  texts: readonly [string, string, string, string]
}

const ISSUE_1008_STEPS: readonly Issue1008Step[] = [
  {
    id: 'initial',
    snapshot: { blockResult: [], closureResult: [], count: 1, parameterResult: [] },
    texts: ['1', '[]', '[]', '[]'],
  },
  {
    button: '#issue1008-parameter',
    id: 'parameter',
    snapshot: { blockResult: [], closureResult: [], count: 1, parameterResult: [2] },
    texts: ['1', '[2]', '[]', '[]'],
  },
  {
    button: '#issue1008-block',
    id: 'block',
    snapshot: { blockResult: [7, 8], closureResult: [], count: 1, parameterResult: [2] },
    texts: ['1', '[2]', '[7,8]', '[]'],
  },
  {
    button: '#issue1008-closure',
    id: 'closure',
    snapshot: { blockResult: [7, 8], closureResult: [5, 5], count: 1, parameterResult: [2] },
    texts: ['1', '[2]', '[7,8]', '[5,5]'],
  },
  {
    button: '#issue1008-setup-ref',
    id: 'setup-ref',
    snapshot: { blockResult: [7, 8], closureResult: [5, 5], count: 7, parameterResult: [2] },
    texts: ['7', '[2]', '[7,8]', '[5,5]'],
  },
]

const ISSUE_1008_CHECKPOINTS = ISSUE_1008_STEPS.map(step => ({
  action: step.button ? `点击 ${step.id} 控件后检查词法写入结果` : '检查 setup ref 与局部结果初始值',
  id: step.id,
  nodes: [
    { selector: '#issue1008-count', text: step.texts[0] },
    { selector: '#issue1008-parameter-result', text: step.texts[1] },
    { selector: '#issue1008-block-result', text: step.texts[2] },
    { selector: '#issue1008-closure-result', text: step.texts[3] },
  ],
  route: ISSUE_1008_ROUTE,
}))

describe('e2e app: github-issues / issue #1008', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('keeps shadowed template writes local while genuine setup ref writes remain live', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', ISSUE_1008_CHECKPOINTS)
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, ISSUE_1008_ROUTE, undefined, 45_000, {
        readiness: async (_page, activeMiniProgram) => {
          const snapshot = await callRoutePageMethod<Issue1008Snapshot>(
            activeMiniProgram,
            ISSUE_1008_ROUTE,
            '_runE2E',
          )
          return snapshot.count === 1
        },
      })
      if (!issuePage) {
        throw new Error('Failed to launch issue-1008 page')
      }
      const activeMiniProgram = await getSharedMiniProgram(ctx)

      for (const extension of ['js', 'json', 'wxml']) {
        await expect(fs.pathExists(path.join(DIST_ROOT, `pages/issue-1008/index.${extension}`))).resolves.toBe(true)
      }

      for (const step of ISSUE_1008_STEPS) {
        if (step.button) {
          const controls = await issuePage.$$(step.button, { fallback: false, timeout: 5_000 })
          expect(controls).toHaveLength(1)
          await controls[0]!.tap()
        }
        await dom.check(step.id, activeMiniProgram, issuePage)
        await expect(callRoutePageMethod<Issue1008Snapshot>(
          activeMiniProgram,
          ISSUE_1008_ROUTE,
          '_runE2E',
        )).resolves.toEqual(step.snapshot)
      }
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
