import fs from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

const ISSUE_558_AUGMENTED_ENV = 'WEAPP_GITHUB_ISSUE_558_AUGMENTED'

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

async function readIssue558WxmlBundle() {
  const issue558DistRoot = path.join(DIST_ROOT, 'pages/issue-558')
  const entries = await fs.readdir(issue558DistRoot)
  const wxmlFiles = entries.filter(file => file.endsWith('.wxml')).sort()
  const contents = await Promise.all(
    wxmlFiles.map(async file => await fs.readFile(path.join(issue558DistRoot, file), 'utf8')),
  )
  return contents.join('\n')
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
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-558/index', undefined, 20_000, {
        readiness: 'route',
      })
      if (!issuePage) {
        throw new Error('Failed to launch issue-558 page')
      }

      const runtime = await miniProgram.evaluate(() => {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
        const page = pages[pages.length - 1]
        if (!page || typeof page._runE2E !== 'function') {
          throw new Error('issue-558 page does not expose _runE2E')
        }
        return page._runE2E()
      })
      const cases = runtime?.cases ?? {}
      const renderedWxml = await readIssue558WxmlBundle()

      expect(runtime?.ok).toBe(true)
      for (const [, expected] of getIssue558ExpectedCases(cases)) {
        expect(expected).toBeTruthy()
      }
      for (const caseName of [
        'plain-default',
        'named-header',
        'explicit-default',
        'named-scoped-footer',
        'default-scoped',
        'nested-default',
      ]) {
        expect(renderedWxml).toContain(`data-issue558-case="${caseName}"`)
      }
      expect(renderedWxml).toContain('data-issue558-case="{{\'list-scoped-\'+__wvSlotPropsData.index}}"')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
