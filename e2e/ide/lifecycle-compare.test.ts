import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/lifecycle-compare')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

const TAB_PATHS = [
  '/pages/native/index',
  '/pages/wevu-ts/index',
  '/pages/wevu-vue/index',
  '/pages/components/index',
]

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    skipNpm: true,
    cwd: APP_ROOT,
    label: 'ide:lifecycle-compare',
  })
}

async function triggerPageEvents(miniProgram: any, pagePath: string) {
  let page = await miniProgram.currentPage()
  await page?.waitFor(300)

  try {
    await miniProgram.callWxMethod('startPullDownRefresh')
    await miniProgram.callWxMethod('stopPullDownRefresh')
  }
  catch {
    // ignore
  }

  try {
    await miniProgram.pageScrollTo(600)
    await page?.waitFor(150)
    await miniProgram.pageScrollTo(2000)
    await page?.waitFor(150)
  }
  catch {
    // ignore
  }

  const fallbackTab = TAB_PATHS.find(p => p !== pagePath)
  if (fallbackTab) {
    await miniProgram.switchTab(fallbackTab)
    page = await miniProgram.switchTab(pagePath)
    await page?.waitFor(200)
  }

  return page
}

function normalizeEntries(entries: any[]) {
  const normalized = entries.map(({ source, componentKind, ...rest }) => {
    const normalizedEntry = { ...rest }

    // "order"/"tick" are transport-level counters and may shift across
    // environments when a transient pageScroll callback is coalesced.
    delete normalizedEntry.order

    if (normalizedEntry.snapshot && typeof normalizedEntry.snapshot === 'object') {
      const snapshot = { ...(normalizedEntry.snapshot as Record<string, unknown>) }
      delete snapshot.tick
      normalizedEntry.snapshot = snapshot
    }

    if (normalizedEntry.hook === 'onPageScroll' && Array.isArray(normalizedEntry.args)) {
      const [options, ...tail] = normalizedEntry.args
      if (options && typeof options === 'object' && 'duration' in options) {
        const { duration, ...others } = options as Record<string, unknown>
        normalizedEntry.args = [others, ...tail]
      }
    }

    return normalizedEntry
  })

  // Some IDE/runtime combinations may merge adjacent scroll callbacks.
  // Keep only the latest entry in a continuous onPageScroll segment.
  const compacted: any[] = []
  for (const entry of normalized) {
    const prev = compacted[compacted.length - 1]
    if (entry.hook === 'onPageScroll' && prev?.hook === 'onPageScroll') {
      compacted[compacted.length - 1] = entry
      continue
    }
    compacted.push(entry)
  }

  return compacted
}

describe.sequential('lifecycle compare (e2e)', () => {
  let miniProgram: any

  beforeAll(async () => {
    await runBuild()
    miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })
  }, 120_000)

  afterAll(async () => {
    if (miniProgram) {
      await miniProgram.close()
    }
  })

  it('compares page lifecycles (native vs wevu ts/vue)', async () => {
    await miniProgram.reLaunch('/pages/native/index?from=e2e')
    const nativeActive = (await triggerPageEvents(miniProgram, '/pages/native/index')) ?? await miniProgram.currentPage()
    await nativeActive.callMethod('finalizeLifecycleLogs')
    const nativeLogs = (await nativeActive.data('__lifecycleLogs')) ?? []
    expect(nativeLogs.length).toBeGreaterThan(0)

    await miniProgram.reLaunch('/pages/wevu-ts/index?from=e2e')
    const wevuTsActive = (await triggerPageEvents(miniProgram, '/pages/wevu-ts/index')) ?? await miniProgram.currentPage()
    await wevuTsActive.callMethod('finalizeLifecycleLogs')
    const wevuTsLogs = (await wevuTsActive.data('__lifecycleLogs')) ?? []

    await miniProgram.reLaunch('/pages/wevu-vue/index?from=e2e')
    const wevuVueActive = (await triggerPageEvents(miniProgram, '/pages/wevu-vue/index')) ?? await miniProgram.currentPage()
    await wevuVueActive.callMethod('finalizeLifecycleLogs')
    const wevuVueLogs = (await wevuVueActive.data('__lifecycleLogs')) ?? []

    expect(normalizeEntries(wevuTsLogs)).toEqual(normalizeEntries(nativeLogs))
    expect(normalizeEntries(wevuVueLogs)).toEqual(normalizeEntries(nativeLogs))
  })

  it('compares component lifecycles (native vs wevu ts/vue)', async () => {
    await miniProgram.reLaunch('/pages/components/index?from=e2e')
    const componentsActive = (await triggerPageEvents(miniProgram, '/pages/components/index')) ?? await miniProgram.currentPage()
    await componentsActive.callMethod('finalizeLifecycleLogs')
    const componentLogs = (await componentsActive.data('__componentLogs')) ?? {}

    const nativeLogs = componentLogs.native ?? []
    const wevuTsLogs = componentLogs['wevu-ts'] ?? []
    const wevuVueLogs = componentLogs['wevu-vue'] ?? []

    expect(nativeLogs.length).toBeGreaterThan(0)
    expect(normalizeEntries(wevuTsLogs)).toEqual(normalizeEntries(nativeLogs))
    expect(normalizeEntries(wevuVueLogs)).toEqual(normalizeEntries(nativeLogs))
  })
})
