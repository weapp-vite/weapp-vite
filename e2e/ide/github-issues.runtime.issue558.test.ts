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
} from './github-issues.runtime.shared'

const ISSUE_558_AUGMENTED_ENV = 'WEAPP_GITHUB_ISSUE_558_AUGMENTED'

describe.sequential('e2e app: github-issues / issue #558', () => {
  beforeAll(async () => {
    process.env[ISSUE_558_AUGMENTED_ENV] = 'true'
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
    delete process.env[ISSUE_558_AUGMENTED_ENV]
  })

  it('renders owner-proxy bindings across augmented slot variants in DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-558/index', 'issue-558 augmented slot computed binding')
      if (!issuePage) {
        throw new Error('Failed to launch issue-558 page')
      }

      const runtime = await issuePage.callMethod('_runE2E')
      const cases = runtime?.cases ?? {}
      const renderedWxml = await readPageWxml(issuePage)

      expect(runtime?.ok).toBe(true)
      expect(renderedWxml).toContain(cases.plainDefault)
      expect(renderedWxml).toContain(cases.namedHeader)
      expect(renderedWxml).toContain(cases.explicitDefault)
      expect(renderedWxml).toContain(cases.namedScopedFooter)
      expect(renderedWxml).toContain(cases.defaultScoped)
      expect(renderedWxml).toContain(cases.listScoped[0])
      expect(renderedWxml).toContain(cases.listScoped[1])
      expect(renderedWxml).toContain(cases.nestedDefault)

      const plainDefault = await issuePage.$('[data-issue558-case="plain-default"]')
      const namedScopedFooter = await issuePage.$('[data-issue558-case="named-scoped-footer"]')
      const defaultScoped = await issuePage.$('[data-issue558-case="default-scoped"]')
      const nestedDefault = await issuePage.$('[data-issue558-case="nested-default"]')
      if (!plainDefault || !namedScopedFooter || !defaultScoped || !nestedDefault) {
        throw new Error('Failed to query issue-558 slot probes')
      }

      expect((await plainDefault.text()).trim()).toBe(cases.plainDefault)
      expect((await namedScopedFooter.text()).trim()).toBe(cases.namedScopedFooter)
      expect((await defaultScoped.text()).trim()).toBe(cases.defaultScoped)
      expect((await nestedDefault.text()).trim()).toBe(cases.nestedDefault)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
