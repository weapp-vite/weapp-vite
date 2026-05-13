import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  delay,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

const ISSUE_558_AUGMENTED_ENV = 'WEAPP_GITHUB_ISSUE_558_AUGMENTED'
const ISSUE_558_RENDER_TIMEOUT = 8_000

function getIssue558ExpectedCases(cases: Record<string, any>) {
  return [
    ['plain-default', cases.plainDefault],
    ['named-header', cases.namedHeader],
    ['explicit-default', cases.explicitDefault],
    ['named-scoped-footer', cases.namedScopedFooter],
    ['default-scoped', cases.defaultScoped],
    ['list-scoped-0', Array.isArray(cases.listScoped) ? cases.listScoped[0] : undefined],
    ['list-scoped-1', Array.isArray(cases.listScoped) ? cases.listScoped[1] : undefined],
    ['nested-default', cases.nestedDefault],
  ].filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)
}

async function readIssue558ProbeTexts(page: any, cases: Record<string, any>) {
  const expectedCases = getIssue558ExpectedCases(cases)
  const result: Record<string, string | undefined> = {}
  for (const [caseName] of expectedCases) {
    const element = await page.$(`[data-issue558-case="${caseName}"]`)
    result[caseName] = element ? (await element.text()).trim() : undefined
  }
  return result
}

async function waitForIssue558ProbeTexts(page: any, cases: Record<string, any>) {
  const expectedCases = getIssue558ExpectedCases(cases)
  const start = Date.now()
  let latestTexts: Record<string, string | undefined> = {}

  while (Date.now() - start <= ISSUE_558_RENDER_TIMEOUT) {
    latestTexts = await readIssue558ProbeTexts(page, cases)
    if (expectedCases.every(([caseName, text]) => latestTexts[caseName] === text)) {
      return latestTexts
    }

    if (typeof page?.waitFor === 'function') {
      await page.waitFor(220)
    }
    else {
      await delay(220)
    }
  }

  return latestTexts
}

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
      const probeTexts = await waitForIssue558ProbeTexts(issuePage, cases)
      const renderedWxml = await readPageWxml(issuePage)

      expect(runtime?.ok).toBe(true)
      for (const [caseName, expected] of getIssue558ExpectedCases(cases)) {
        expect(probeTexts[caseName]).toBe(expected)
        expect(renderedWxml).toContain(`data-issue558-case="${caseName}"`)
      }

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
