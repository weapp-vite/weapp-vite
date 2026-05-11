import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  delay,
  getSharedMiniProgram,
  prepareGithubIssuesBuild,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
  tapElement,
} from './github-issues.runtime.shared'

async function waitForElementText(page: any, selector: string, expected: string, timeoutMs = 15_000) {
  const start = Date.now()
  let lastText = ''
  while (Date.now() - start <= timeoutMs) {
    const element = await page.$(selector)
    if (element) {
      lastText = (await element.text()).trim()
      if (lastText === expected) {
        return element
      }
    }
    await delay(220)
  }
  throw new Error(`Timed out waiting ${selector} text to equal ${JSON.stringify(expected)}; last text=${JSON.stringify(lastText)}`)
}

describe.sequential('e2e app: github-issues / issues #553 #555', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, 60_000)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('updates component v-model argument bindings in DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-553/index', 'issue-553 component v-model argument')
      if (!issuePage) {
        throw new Error('Failed to launch issue-553 page')
      }

      const initialWxml = await readPageWxml(issuePage)
      expect(initialWxml).toContain('issue-553 initial title')

      await tapElement(issuePage, '[data-issue553-update="true"]')

      const updatedWxml = await readPageWxml(issuePage)
      expect(updatedWxml).toContain('data-issue553-parent-title="issue-553 updated title"')
      expect(updatedWxml).toContain('data-issue553-child-title="issue-553 updated title"')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('renders slotSingleRootNoWrapper v-if slot content in DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-555/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-555 page')
      }

      const runtimeResult = await issuePage.callMethod('_runE2E') as { value?: unknown }
      expect(runtimeResult?.value).toBe('issue-555 conditional slot text')
      const renderedWxml = await readPageWxml(issuePage)
      expect(renderedWxml).toContain('data-probe="conditional-text"')

      const textProbe = await waitForElementText(issuePage, '.issue555-text-probe', 'issue-555 conditional slot text')
      expect((await textProbe.text()).trim()).toBe('issue-555 conditional slot text')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
