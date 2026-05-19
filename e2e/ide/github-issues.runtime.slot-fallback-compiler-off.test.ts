import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  delay,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

function countToken(wxml: string, token: string) {
  return wxml.split(token).length - 1
}

const SLOT_FALLBACK_RENDER_TIMEOUT = 8_000
const slotFallbackExpectedCases = [
  ['fallback-header', 'slot-fallback-compiler-off fallback header'],
  ['fallback-default', 'slot-fallback-compiler-off fallback default'],
  ['provided-header', 'slot-fallback-compiler-off provided header'],
  ['provided-default', 'slot-fallback-compiler-off provided default'],
] as const

async function readSlotFallbackTexts(page: any) {
  const result: Record<string, string | undefined> = {}
  for (const [caseName] of slotFallbackExpectedCases) {
    const element = await page.$(`[data-slot-fallback-off-case="${caseName}"]`)
    result[caseName] = element ? (await element.text()).trim() : undefined
  }
  return result
}

async function waitForSlotFallbackTexts(page: any) {
  const start = Date.now()
  let latestTexts: Record<string, string | undefined> = {}

  while (Date.now() - start <= SLOT_FALLBACK_RENDER_TIMEOUT) {
    latestTexts = await readSlotFallbackTexts(page)
    if (slotFallbackExpectedCases.every(([caseName, expected]) => latestTexts[caseName] === expected)) {
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

describe.sequential('e2e app: github-issues / slot fallback compiler off', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders plain slot fallback independently from scopedSlotsCompiler', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(
        miniProgram,
        '/pages/slot-fallback-compiler-off/index',
      )
      if (!issuePage) {
        throw new Error('Failed to launch slot-fallback-compiler-off page')
      }

      const probeTexts = await waitForSlotFallbackTexts(issuePage)
      const renderedWxml = await readPageWxml(issuePage)
      for (const [caseName, expected] of slotFallbackExpectedCases) {
        expect(probeTexts[caseName]).toBe(expected)
        expect(renderedWxml).toContain(`data-slot-fallback-off-case="${caseName}"`)
        expect(countToken(renderedWxml, `data-slot-fallback-off-case="${caseName}"`)).toBe(1)
      }

      const computedErrorScript = await fs.readFile(
        path.join(DIST_ROOT, 'pages/slot-fallback-computed-error/index.js'),
        'utf8',
      )
      expect(computedErrorScript).toContain('console.error')
      expect(computedErrorScript).toContain('[wevu]')
      expect(computedErrorScript).toContain('__wv_bind_0 = missingMigratedComputed()')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
