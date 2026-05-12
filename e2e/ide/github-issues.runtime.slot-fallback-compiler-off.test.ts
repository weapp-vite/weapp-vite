import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

function countToken(wxml: string, token: string) {
  return wxml.split(token).length - 1
}

describe.sequential('e2e app: github-issues / slot fallback compiler off', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders plain slot fallback independently from scopedSlotsCompiler', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(
        miniProgram,
        '/pages/slot-fallback-compiler-off/index',
        'slot-fallback-compiler-off fallback default',
      )
      if (!issuePage) {
        throw new Error('Failed to launch slot-fallback-compiler-off page')
      }

      const renderedWxml = await readPageWxml(issuePage)
      expect(renderedWxml).toContain('slot-fallback-compiler-off fallback header')
      expect(renderedWxml).toContain('slot-fallback-compiler-off fallback default')
      expect(renderedWxml).toContain('slot-fallback-compiler-off provided header')
      expect(renderedWxml).toContain('slot-fallback-compiler-off provided default')
      expect(countToken(renderedWxml, 'slot-fallback-compiler-off fallback header')).toBe(1)
      expect(countToken(renderedWxml, 'slot-fallback-compiler-off fallback default')).toBe(1)
      expect(countToken(renderedWxml, 'slot-fallback-compiler-off provided header')).toBe(1)
      expect(countToken(renderedWxml, 'slot-fallback-compiler-off provided default')).toBe(1)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
