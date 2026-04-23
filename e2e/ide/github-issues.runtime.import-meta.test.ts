import { afterAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  launchFreshMiniProgram,
  readPageWxml,
  relaunchPage,
} from './github-issues.runtime.shared'

describe.sequential('github-issues runtime import.meta bindings', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('issue #431: renders supported native wxml import.meta bindings at runtime', async (ctx) => {
    const miniProgram = await launchFreshMiniProgram(ctx)

    try {
      const page = await relaunchPage(
        miniProgram,
        '/pages/issue-431/index',
        'issue-431 native wxml env replacement',
        20_000,
      )
      if (!page) {
        throw new Error('Failed to launch issue-431 page')
      }

      const pageWxml = await readPageWxml(page)
      const doubleProbe = await page.$('[data-case="double"]')
      const singleProbe = await page.$('[data-case="single"]')
      if (!doubleProbe || !singleProbe) {
        throw new Error('Failed to find issue-431 import.meta probe elements')
      }

      for (const probe of [doubleProbe, singleProbe]) {
        expect(await probe.attribute('data-template-url')).toBe('/pages/issue-431/index.wxml')
        expect(await probe.attribute('data-template-dir')).toBe('/pages/issue-431')
        expect(await probe.attribute('data-env-label')).toBe('issue-431 native wxml env replacement')
        expect(await probe.attribute('data-env-base')).toBe('https://static.example.com/issue-431')
      }

      expect(pageWxml).toContain('data-case="double"')
      expect(pageWxml).toContain('data-case="single"')
      expect(pageWxml).toContain('data-template-url="/pages/issue-431/index.wxml"')
      expect(pageWxml).toContain('data-template-dir="/pages/issue-431"')
      expect(pageWxml).toContain('data-env-label="issue-431 native wxml env replacement"')
      expect(pageWxml).toContain('data-env-base="https://static.example.com/issue-431"')
      expect(pageWxml).not.toContain('import.meta.env')
      expect(pageWxml).not.toContain('import.meta.url')
      expect(pageWxml).not.toContain('import.meta.dirname')
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })
})
