import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'
import { INLINE_ASSIGNMENT_CHECKPOINTS, INLINE_ASSIGNMENT_STEPS } from './githubIssuesDom/reactivity'

const ISSUE_621_AUGMENTED_ENV = 'WEAPP_GITHUB_ISSUE_621_AUGMENTED'

async function readIssue621Runtime(miniProgram: any) {
  return await miniProgram.evaluate(() => {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1] as any
    return page?._runE2E?.()
  })
}

async function waitForIssue621Runtime(miniProgram: any, timeoutMs = 15_000) {
  const startedAt = Date.now()
  let latest: unknown
  while (Date.now() - startedAt <= timeoutMs) {
    latest = await readIssue621Runtime(miniProgram).catch(() => undefined)
    if ((latest as { ok?: boolean } | undefined)?.ok === true) {
      return latest
    }
    await new Promise(resolve => setTimeout(resolve, 220))
  }
  throw new Error(`Timed out waiting for issue-621 runtime readiness. Latest runtime: ${JSON.stringify(latest)}`)
}

describe('e2e app: github-issues / issue #621', { concurrent: false }, () => {
  beforeAll(async () => {
    process.env[ISSUE_621_AUGMENTED_ENV] = 'true'
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
    delete process.env[ISSUE_621_AUGMENTED_ENV]
  })

  it('keeps inline assignment events writable for setup refs in DevTools', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', INLINE_ASSIGNMENT_CHECKPOINTS)
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(
        miniProgram,
        '/pages/issue-621/index',
        'issue-621 inline assignment event',
        45_000,
        {
          readiness: 'route',
        },
      )
      if (!issuePage) {
        throw new Error('Failed to launch issue-621 page')
      }

      const initialRuntime = await waitForIssue621Runtime(miniProgram)
      expect(initialRuntime).toMatchObject({
        count: 0,
        explicitCount: 0,
        derivedCount: 0,
        prefixCount: 0,
        conditionalCount: 0,
        sequenceCount: 0,
        argumentCount: 0,
        shorthandCount: 0,
        nestedCount: 0,
        ok: true,
      })

      const activeMiniProgram = await getSharedMiniProgram(ctx)
      for (const step of INLINE_ASSIGNMENT_STEPS) {
        if (step.tap) {
          const controls = await issuePage.$$(`.issue621-button-${step.tap}`, { fallback: false, timeout: 5_000 })
          expect(controls).toHaveLength(1)
          await controls[0].tap()
        }
        await dom.check(step.id, activeMiniProgram, issuePage)
      }

      const finalRuntime = await readIssue621Runtime(activeMiniProgram)

      expect(finalRuntime).toMatchObject({
        count: 1,
        explicitCount: 1,
        derivedCount: 1,
        prefixCount: 1,
        conditionalCount: 3,
        sequenceCount: 2,
        argumentCount: 1,
        shorthandCount: 1,
        nestedCount: 1,
        ok: true,
      })
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
