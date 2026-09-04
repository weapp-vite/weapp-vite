import fs from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  delay,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

const ISSUE_558_AUGMENTED_ENV = 'WEAPP_GITHUB_ISSUE_558_AUGMENTED'

const ISSUE_558_EXPECTED_RENDERED_CASES = {
  plainDefault: '987654321',
  namedHeader: 'redaeh',
  explicitDefault: 'tluafed',
  namedScopedFooter: 'retoof-987654321',
  defaultScoped: '987654321-2-tluafed-depocs',
  listScoped: [
    '987654321-0-ahpla',
    '987654321-1-ateb',
  ],
  nestedOuter: 'retuo',
  nestedDefault: 'detsen',
}

async function waitForIssue558Runtime(page: any, timeoutMs = 30_000) {
  const startedAt = Date.now()
  let latest: Record<string, any> | null = null
  let lastError: unknown

  while (Date.now() - startedAt < timeoutMs) {
    try {
      latest = await page.callMethod('_runE2E')
      if (latest?.ok === true) {
        return latest
      }
    }
    catch (error) {
      lastError = error
    }
    await delay(160)
  }

  if (latest == null && lastError) {
    throw lastError
  }
  return latest
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

describe('e2e app: github-issues / issue #558', { concurrent: false }, () => {
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
        readiness: async (page) => {
          const runtime = await page.callMethod('_runE2E')
          return runtime != null && typeof runtime.cases === 'object'
        },
      })
      if (!issuePage) {
        throw new Error('Failed to launch issue-558 page')
      }

      const runtime = await waitForIssue558Runtime(issuePage)
      const renderedWxml = await readIssue558WxmlBundle()

      expect(runtime?.cases).toEqual(ISSUE_558_EXPECTED_RENDERED_CASES)
      expect(runtime?.ok).toBe(true)
      expect(renderedWxml).toContain('<issue-558-render-probe')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
