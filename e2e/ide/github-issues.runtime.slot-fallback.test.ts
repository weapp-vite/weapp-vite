import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  prepareGithubIssuesBuild,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

function countToken(wxml: string, token: string) {
  return wxml.split(token).length - 1
}

function readOffsetNumber(offset: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = offset[key]
    if (typeof value === 'number') {
      return value
    }
  }
  return undefined
}

describe.sequential('e2e app: github-issues / slot fallback', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  })

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('issue #520: renders slots passed to resolver-imported wevu components', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-520/index', 'issue-520 resolver slot default')
      if (!issuePage) {
        throw new Error('Failed to launch issue-520 page')
      }

      const renderedWxml = await readPageWxml(issuePage)
      expect(renderedWxml).toContain('data-issue520-slot="header"')
      expect(renderedWxml).toContain('data-issue520-slot="default"')

      const header = await issuePage.$('[data-issue520-slot="header"]')
      const defaultSlot = await issuePage.$('[data-issue520-slot="default"]')
      if (!header || !defaultSlot) {
        throw new Error('Failed to query issue-520 slot probes')
      }
      expect((await header.text()).trim()).toBe('issue-520 resolver slot header')
      expect((await defaultSlot.text()).trim()).toBe('issue-520 resolver slot default')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #521: keeps scoped slot flex children on the same row in DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-521/index', 'issue-521 scoped slot flex layout')
      if (!issuePage) {
        throw new Error('Failed to launch issue-521 page')
      }

      const firstItem = await issuePage.$('[data-label="A"]')
      const secondItem = await issuePage.$('[data-label="B"]')
      if (!firstItem || !secondItem) {
        throw new Error('Failed to query issue-521 flex items')
      }

      expect(await firstItem.text()).toContain('A: 0')
      expect(await secondItem.text()).toContain('B: 0')

      const firstOffset = await firstItem.offset()
      const secondOffset = await secondItem.offset()
      const firstLeft = readOffsetNumber(firstOffset, ['left', 'x'])
      const secondLeft = readOffsetNumber(secondOffset, ['left', 'x'])
      const firstTop = readOffsetNumber(firstOffset, ['top', 'y'])
      const secondTop = readOffsetNumber(secondOffset, ['top', 'y'])

      expect(firstLeft).toBeTypeOf('number')
      expect(secondLeft).toBeTypeOf('number')
      expect(firstTop).toBeTypeOf('number')
      expect(secondTop).toBeTypeOf('number')
      expect(secondLeft! - firstLeft!).toBeGreaterThan(20)
      expect(Math.abs(secondTop! - firstTop!)).toBeLessThanOrEqual(2)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
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

  it('issue #530: renders default slot fallback with short slot presence metadata', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-530/index', 'issue530-fallback-default')
      if (!issuePage) {
        throw new Error('Failed to launch issue-530 page')
      }

      const renderedWxml = await readPageWxml(issuePage)
      expect(renderedWxml).toContain('issue530-fallback-default')
      expect(renderedWxml).toContain('issue530-provided-default')
      expect(countToken(renderedWxml, 'issue530-fallback-default')).toBe(1)
      expect(countToken(renderedWxml, 'issue530-provided-default')).toBe(1)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
