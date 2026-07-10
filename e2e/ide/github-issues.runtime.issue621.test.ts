import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

const ISSUE_621_AUGMENTED_ENV = 'WEAPP_GITHUB_ISSUE_621_AUGMENTED'

async function readIssue621Runtime(miniProgram: any) {
  return await miniProgram.evaluate(() => {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1] as any
    return page?._runE2E?.()
  })
}

async function callInlineTap(miniProgram: any, inlineId: string) {
  await miniProgram.evaluate((targetInlineId: string) => {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1] as any
    return page?.__weapp_vite_inline?.({
      type: 'tap',
      currentTarget: {
        dataset: {
          wiTap: targetInlineId,
        },
      },
      target: {
        dataset: {
          wiTap: targetInlineId,
        },
      },
    })
  }, inlineId)
}

describe.sequential('e2e app: github-issues / issue #621', () => {
  beforeAll(async () => {
    process.env[ISSUE_621_AUGMENTED_ENV] = 'true'
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
    delete process.env[ISSUE_621_AUGMENTED_ENV]
  })

  it('keeps inline assignment events writable for setup refs in DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(
        miniProgram,
        '/pages/issue-621/index',
        'issue-621 inline assignment event',
        45_000,
        {
          readiness: async () => {
            const result = await readIssue621Runtime(miniProgram)
            return result?.ok === true
          },
        },
      )
      if (!issuePage) {
        throw new Error('Failed to launch issue-621 page')
      }

      const initialRuntime = await readIssue621Runtime(miniProgram)
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

      await callInlineTap(miniProgram, 'i0')
      const afterCountRuntime = await readIssue621Runtime(miniProgram)

      expect(afterCountRuntime).toMatchObject({
        count: 1,
        explicitCount: 0,
        ok: true,
      })

      await callInlineTap(miniProgram, 'i1')
      const afterExplicitRuntime = await readIssue621Runtime(miniProgram)

      expect(afterExplicitRuntime).toMatchObject({
        count: 1,
        explicitCount: 1,
        ok: true,
      })

      await callInlineTap(miniProgram, 'i2')
      await callInlineTap(miniProgram, 'i3')
      await callInlineTap(miniProgram, 'i4')
      await callInlineTap(miniProgram, 'i4')
      await callInlineTap(miniProgram, 'i5')
      await callInlineTap(miniProgram, 'i6')
      await callInlineTap(miniProgram, 'i7')
      await callInlineTap(miniProgram, 'i8')

      const finalRuntime = await readIssue621Runtime(miniProgram)

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
