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

const slotFallbackExpectedCases = [
  ['fallback-header', 'slot-fallback-compiler-off fallback header'],
  ['fallback-default', 'slot-fallback-compiler-off fallback default'],
  ['provided-header', 'slot-fallback-compiler-off provided header'],
  ['provided-default', 'slot-fallback-compiler-off provided default'],
] as const

async function readDistText(...segments: string[]) {
  return await fs.readFile(path.join(DIST_ROOT, ...segments), 'utf8')
}

describe.sequential('e2e app: github-issues / slot fallback compiler off', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(() => {
    disconnectSharedMiniProgram()
  })

  it('renders plain slot fallback independently from scopedSlotsCompiler', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    const route = '/pages/slot-fallback-compiler-off/index'
    try {
      const issuePage = await relaunchPage(
        miniProgram,
        route,
        undefined,
        45_000,
        {
          readiness: async page => Boolean(await page.waitForRendered({
            dataset: {
              e2eRoute: 'slot-fallback-compiler-off',
            },
            selector: '#slot-fallback-compiler-off-page',
            timeout: 15_000,
          })),
        },
      )
      if (!issuePage) {
        throw new Error('Failed to launch slot-fallback-compiler-off page')
      }
      const runtime = await issuePage.callMethod('_runE2E') as Record<string, string>
      expect(runtime).toMatchObject({
        fallbackHeader: 'slot-fallback-compiler-off fallback header',
        fallbackDefault: 'slot-fallback-compiler-off fallback default',
        providedHeader: 'slot-fallback-compiler-off provided header',
        providedDefault: 'slot-fallback-compiler-off provided default',
      })

      const pageWxml = await readDistText('pages/slot-fallback-compiler-off/index.wxml')
      const cardWxml = await readDistText('components/slot-fallback-compiler-off/PlainSlotFallbackCard/index.wxml')
      const cardScript = await readDistText('components/slot-fallback-compiler-off/PlainSlotFallbackCard/index.js')
      for (const [caseName, expected] of slotFallbackExpectedCases) {
        const source = caseName.startsWith('fallback-') ? cardWxml : pageWxml
        expect(caseName === 'fallback-default' ? cardScript : source).toContain(expected)
        expect(source).toContain(`data-slot-fallback-off-case="${caseName}"`)
        expect(countToken(source, `data-slot-fallback-off-case="${caseName}"`)).toBe(1)
      }

      const computedErrorScript = await readDistText('pages/slot-fallback-computed-error/index.js')
      expect(computedErrorScript).toContain('console.error')
      expect(computedErrorScript).toContain('[wevu]')
      expect(computedErrorScript).toContain('__wv_bind_0 = missingMigratedComputed()')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
