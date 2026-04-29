import { afterAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

function countToken(wxml: string, token: string) {
  return wxml.split(token).length - 1
}

describe.sequential('e2e app: github-issues / slot fallback', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('issue #528: renders slot fallback only when parent slot content is absent', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-528/index', 'issue528-fallback-default')
      if (!issuePage) {
        throw new Error('Failed to launch issue-528 page')
      }

      const renderedWxml = await readPageWxml(issuePage)
      expect(renderedWxml).toContain('issue528-fallback-header')
      expect(renderedWxml).toContain('issue528-fallback-default')
      expect(renderedWxml).toContain('issue528-provided-header')
      expect(renderedWxml).toContain('issue528-provided-default')
      expect(countToken(renderedWxml, 'issue528-fallback-header')).toBe(1)
      expect(countToken(renderedWxml, 'issue528-fallback-default')).toBe(1)
      expect(countToken(renderedWxml, 'issue528-provided-header')).toBe(1)
      expect(countToken(renderedWxml, 'issue528-provided-default')).toBe(1)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
