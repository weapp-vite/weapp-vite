import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  disconnectSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

function countToken(wxml: string, token: string) {
  return wxml.split(token).length - 1
}

async function readDistText(...segments: string[]) {
  return await fs.readFile(path.join(DIST_ROOT, ...segments), 'utf8')
}

describe.sequential('e2e app: github-issues / slot fallback', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(() => {
    disconnectSharedMiniProgram()
  })

  it('issue #520: renders slots passed to resolver-imported wevu components', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    const route = '/pages/issue-520/index'
    try {
      const issuePage = await relaunchPage(miniProgram, route, undefined, 45_000, { readiness: 'route' })
      if (!issuePage) {
        throw new Error('Failed to launch issue-520 page')
      }

      const runtime = await issuePage.callMethod('_runE2E') as Record<string, string>
      expect(runtime).toMatchObject({
        header: 'issue-520 resolver slot header',
        defaultSlot: 'issue-520 resolver slot default',
      })

      const pageWxml = await readDistText('pages/issue-520/index.wxml')
      expect(pageWxml).toContain('data-issue520-slot="header"')
      expect(pageWxml).toContain('data-issue520-slot="default"')
      expect(pageWxml).toContain('issue-520 resolver slot header')
      expect(pageWxml).toContain('issue-520 resolver slot default')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #521: keeps scoped slot flex children on the same row in DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    const route = '/pages/issue-521/index'
    try {
      const issuePage = await relaunchPage(miniProgram, route, undefined, 45_000, { readiness: 'route' })
      if (!issuePage) {
        throw new Error('Failed to launch issue-521 page')
      }

      const pageWxml = await readDistText('pages/issue-521/index.wxml')
      const hostWxml = await readDistText('components/issue-521/ScopedFlexHost/index.wxml')
      const itemWxml = await readDistText('components/issue-521/FlexItem/index.wxml')
      const hostWxss = await readDistText('components/issue-521/ScopedFlexHost/index.wxss')
      expect(pageWxml).toContain('generic:scoped-slots-default=')
      expect(hostWxml).toContain('__wvSlotProps="{{[\'xyz\',\'zero\']}}"')
      expect(itemWxml).toContain('data-label="{{label}}"')
      expect(itemWxml).toContain('{{label}}: {{displayValue}}')
      expect(hostWxss).toMatch(/display:\s*flex/)
      expect(hostWxss).toMatch(/flex-flow:\s*row nowrap/)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #528: renders slot fallback only when parent slot content is absent', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    const route = '/pages/issue-528/index'
    try {
      const issuePage = await relaunchPage(miniProgram, route, undefined, 45_000, { readiness: 'route' })
      if (!issuePage) {
        throw new Error('Failed to launch issue-528 page')
      }

      const runtime = await issuePage.callMethod('_runE2E') as Record<string, string>
      expect(runtime).toMatchObject({
        fallbackHeader: 'issue-528 fallback header',
        fallbackDefault: 'issue-528 fallback default',
        providedHeader: 'issue-528 provided header',
        providedDefault: 'issue-528 provided default',
      })

      const pageWxml = await readDistText('pages/issue-528/index.wxml')
      const cardWxml = await readDistText('components/issue-528/SlotFallbackCard/index.wxml')
      const cardScript = await readDistText('components/issue-528/SlotFallbackCard/index.js')
      expect(countToken(cardWxml, 'issue-528 fallback header')).toBe(1)
      expect(cardScript).toContain('issue-528 fallback default')
      expect(countToken(pageWxml, 'issue-528 provided header')).toBe(1)
      expect(countToken(pageWxml, 'issue-528 provided default')).toBe(1)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #530: renders default slot fallback with short slot presence metadata', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    const route = '/pages/issue-530/index'
    try {
      const issuePage = await relaunchPage(miniProgram, route, undefined, 45_000, { readiness: 'route' })
      if (!issuePage) {
        throw new Error('Failed to launch issue-530 page')
      }

      const pageWxml = await readDistText('pages/issue-530/index.wxml')
      const componentWxml = await readDistText('components/issue-530/SlotFallbackProbe/index.wxml')
      const scopedSlotWxml = await readDistText('pages/issue-530/index.__scoped-slot-default-0.wxml')
      expect(pageWxml).toContain('generic:scoped-slots-default=')
      expect(countToken(componentWxml, 'issue-530 fallback default')).toBe(1)
      expect(countToken(componentWxml, 'issue-530 scoped fallback default')).toBe(1)
      expect(scopedSlotWxml).toContain('issue-530 provided default: {{__wvSlotPropsData.label}}')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('scoped slot outlet fallback: renders native named slot projection in DevTools', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    const route = '/pages/scoped-slot-outlet-fallback/index'
    try {
      const issuePage = await relaunchPage(
        miniProgram,
        route,
        undefined,
        45_000,
        { readiness: 'route' },
      )
      if (!issuePage) {
        throw new Error('Failed to launch scoped-slot-outlet-fallback page')
      }

      const pageWxml = await readDistText('pages/scoped-slot-outlet-fallback/index.wxml')
      const componentWxml = await readDistText('components/scoped-slot-outlet-fallback/BackList/index.wxml')
      expect(pageWxml).toContain('scoped slot outlet native main fallback')
      expect(pageWxml).toContain('scoped slot outlet native footer fallback')
      expect(countToken(pageWxml, 'data-scoped-slot-outlet-fallback="main"')).toBe(1)
      expect(countToken(pageWxml, 'data-scoped-slot-outlet-fallback="footer"')).toBe(1)
      expect(componentWxml).toContain('<slot name="main" />')
      expect(componentWxml).toContain('<slot name="footer" />')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
