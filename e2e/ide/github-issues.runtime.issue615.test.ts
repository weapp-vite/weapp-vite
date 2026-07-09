import fs from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  callCurrentPageMethod,
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

const ISSUE_615_AUGMENTED_ENV = 'WEAPP_GITHUB_ISSUE_615_AUGMENTED'

async function readIssue615WxmlBundle() {
  const issue615DistRoot = path.join(DIST_ROOT, 'pages/issue-615')
  const entries = await fs.readdir(issue615DistRoot)
  const wxmlFiles = entries.filter(file => file.endsWith('.wxml')).sort()
  const contents = await Promise.all(
    wxmlFiles.map(async file => await fs.readFile(path.join(issue615DistRoot, file), 'utf8')),
  )
  return contents.join('\n')
}

describe.sequential('e2e app: github-issues / issue #615', () => {
  beforeAll(async () => {
    process.env[ISSUE_615_AUGMENTED_ENV] = 'true'
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
    delete process.env[ISSUE_615_AUGMENTED_ENV]
  })

  it('renders scoped slot v-for owner list in DevTools without owner initialization errors', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-615/index', undefined, 20_000, {
        readiness: async () => {
          const runtime = await callCurrentPageMethod(miniProgram, '_runE2E')
          return runtime?.ok === true
        },
      })
      if (!issuePage) {
        throw new Error('Failed to launch issue-615 page')
      }

      const runtime = await callCurrentPageMethod(miniProgram, '_runE2E')
      const labels = Array.isArray(runtime?.labels) ? runtime.labels : []
      const renderedWxml = await readIssue615WxmlBundle()

      expect(runtime?.ok).toBe(true)
      expect(labels).toEqual(['issue-615-tab-1', 'issue-615-tab-2', 'issue-615-tab-3'])
      expect(renderedWxml).toContain('generic:scoped-slots-default=')
      expect(renderedWxml).toContain('data-issue615-label="{{item.label}}"')
      expect(renderedWxml).toContain('data-issue615-slot-ready="{{__wvSlotPropsData?\'ready\':\'missing\'}}"')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
