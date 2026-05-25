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

const ISSUE_615_AUGMENTED_ENV = 'WEAPP_GITHUB_ISSUE_615_AUGMENTED'
const ISSUE_615_RENDER_TIMEOUT = 8_000

async function readIssue615Labels(page: any, labels: string[]) {
  const result: string[] = []
  for (const label of labels) {
    const element = await page.$(`[data-issue615-label="${label}"]`)
    if (element) {
      result.push((await element.text()).trim())
    }
  }
  return result
}

async function waitForIssue615Labels(page: any, labels: string[]) {
  const start = Date.now()
  let latestLabels: string[] = []

  while (Date.now() - start <= ISSUE_615_RENDER_TIMEOUT) {
    latestLabels = await readIssue615Labels(page, labels)
    if (latestLabels.length === labels.length && latestLabels.every((label, index) => label === labels[index])) {
      return latestLabels
    }

    if (typeof page?.waitFor === 'function') {
      await page.waitFor(220)
    }
    else {
      await delay(220)
    }
  }

  return latestLabels
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
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-615/index', 'issue-615 scoped slot v-for owner list')
      if (!issuePage) {
        throw new Error('Failed to launch issue-615 page')
      }

      const runtime = await issuePage.callMethod('_runE2E')
      const labels = Array.isArray(runtime?.labels) ? runtime.labels : []
      const probeLabels = await waitForIssue615Labels(issuePage, labels)
      const renderedWxml = await readPageWxml(issuePage)

      expect(runtime?.ok).toBe(true)
      expect(probeLabels).toEqual(labels)
      for (const label of labels) {
        expect(renderedWxml).toContain(`data-issue615-label="${label}"`)
      }
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
