import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
  tapElement,
} from './github-issues.runtime.shared'

const ISSUE_621_AUGMENTED_ENV = 'WEAPP_GITHUB_ISSUE_621_AUGMENTED'

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
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-621/index', 'issue-621 inline assignment event')
      if (!issuePage) {
        throw new Error('Failed to launch issue-621 page')
      }

      const initialRuntime = await issuePage.callMethod('_runE2E')
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

      await tapElement(issuePage, '.issue621-button-count')
      const afterCountRuntime = await issuePage.callMethod('_runE2E')
      const afterCountWxml = await readPageWxml(issuePage)

      expect(afterCountRuntime).toMatchObject({
        count: 1,
        explicitCount: 0,
        ok: true,
      })
      expect(afterCountWxml).toContain('data-issue621-count="1"')

      await tapElement(issuePage, '.issue621-button-explicit')
      const afterExplicitRuntime = await issuePage.callMethod('_runE2E')
      const afterExplicitWxml = await readPageWxml(issuePage)

      expect(afterExplicitRuntime).toMatchObject({
        count: 1,
        explicitCount: 1,
        ok: true,
      })
      expect(afterExplicitWxml).toContain('data-issue621-explicit-count="1"')

      await tapElement(issuePage, '.issue621-button-derived')
      await tapElement(issuePage, '.issue621-button-prefix')
      await tapElement(issuePage, '.issue621-button-conditional')
      await tapElement(issuePage, '.issue621-button-conditional')
      await tapElement(issuePage, '.issue621-button-sequence')
      await tapElement(issuePage, '.issue621-button-argument')
      await tapElement(issuePage, '.issue621-button-shorthand')
      await tapElement(issuePage, '.issue621-button-nested')

      const finalRuntime = await issuePage.callMethod('_runE2E')
      const finalWxml = await readPageWxml(issuePage)

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
      expect(finalWxml).toContain('data-issue621-derived-count="1"')
      expect(finalWxml).toContain('data-issue621-prefix-count="1"')
      expect(finalWxml).toContain('data-issue621-conditional-count="3"')
      expect(finalWxml).toContain('data-issue621-sequence-count="2"')
      expect(finalWxml).toContain('data-issue621-argument-count="1"')
      expect(finalWxml).toContain('data-issue621-shorthand-count="1"')
      expect(finalWxml).toContain('data-issue621-nested-count="1"')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
