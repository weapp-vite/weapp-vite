import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
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

  // Some IDE/runtime combinations may merge adjacent callbacks or emit
  // routeDone more than once in the same transition.
  // Keep only the latest entry in a continuous segment.
  const compacted: any[] = []
  for (const entry of normalized) {
    const prev = compacted.at(-1)
    if (
      (entry.hook === 'onPageScroll' && prev?.hook === 'onPageScroll')
      || (entry.hook === 'onRouteDone' && prev?.hook === 'onRouteDone')
    ) {
      compacted[compacted.length - 1] = entry
      continue
    }
    compacted.push(entry)
  }

  return compacted
}

interface EventBindingStats {
  view: {
    bindtap: number
    bindColonTap: number
    bothBindtap: number
    bothBindColonTap: number
    bothReverseBindtap: number
    bothReverseBindColonTap: number
  }
  nativeComponent: {
    bindprobe: number
    bindColonProbe: number
    bothBindprobe: number
    bothBindColonProbe: number
    bothReverseBindprobe: number
    bothReverseBindColonProbe: number
  }
  wevuSfcComponent: {
    bindprobe: number
    bindColonProbe: number
    bothBindprobe: number
    bothBindColonProbe: number
    bothReverseBindprobe: number
    bothReverseBindColonProbe: number
  }
}

interface NamedEventBindingCounters {
  bind: number
  bindColon: number
  bothBind: number
  bothBindColon: number
}

interface NamedEventBindingStats {
  hyphen: {
    nativeComponent: NamedEventBindingCounters
    wevuSfcComponent: NamedEventBindingCounters
  }
  underscore: {
    nativeComponent: NamedEventBindingCounters
    wevuSfcComponent: NamedEventBindingCounters
  }
}

async function tapElementById(page: any, id: string) {
  const element = await page.$(`#${id}`)
  if (!element) {
    throw new Error(`Failed to find element: #${id}`)
  }
  const actions = [
    async () => await element.tap(),
    async () => await element.trigger('tap'),
    async () => {
      await element.touchstart()
      await element.touchend()
    },
    async () => await element.dispatchEvent({ eventName: 'tap' }),
  ]

  for (const action of actions) {
    try {
      await action()
      return
    }
    catch {
      // continue fallback
    }
  }
  throw new Error(`Failed to dispatch tap-like event for: #${id}`)
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await runBuild()
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })
  }
  return sharedMiniProgram
}

async function releaseSharedMiniProgram(miniProgram: any) {
  if (!sharedMiniProgram || sharedMiniProgram === miniProgram) {
    return
  }
  await miniProgram.close()
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close()
}

describe.sequential('lifecycle compare (e2e)', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('compares page lifecycles (native vs wevu ts/vue)', async () => {
    const miniProgram = await getSharedMiniProgram()
    try {
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
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('compares component lifecycles (native vs wevu ts/vue)', async () => {
    const miniProgram = await getSharedMiniProgram()
    try {
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
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('verifies bind event alias behavior for native view/native component/wevu sfc component', async () => {
    const miniProgram = await getSharedMiniProgram()
    try {
      const page = await miniProgram.reLaunch('/pages/components/index?from=e2e-event-binding')
      if (!page) {
        throw new Error('Failed to launch components page for event binding verify')
      }
      await page.waitFor(500)
      await page.callMethod('resetEventBindingStats')
      await page.waitFor(120)

      await tapElementById(page, 'eventViewBindtap')
      await page.waitFor(120)
      await tapElementById(page, 'eventViewBindColon')
      await page.waitFor(120)
      await tapElementById(page, 'eventViewBoth')
      await page.waitFor(120)
      await tapElementById(page, 'eventViewBothReverse')
      await page.waitFor(180)

      for (const componentType of ['nativeComponent', 'wevuSfcComponent'] as const) {
        for (const bindingMode of ['bind', 'bindColon', 'both', 'bothReverse'] as const) {
          const triggered = await page.callMethod('triggerComponentProbe', componentType, bindingMode)
          expect(triggered).toBe(true)
          await page.waitFor(120)
        }
      }

      await page.waitFor(180)
      const stats = await page.callMethod('getEventBindingStats') as EventBindingStats
      expect(stats.view.bindtap).toBe(1)
      expect(stats.view.bindColonTap).toBe(1)
      expect(stats.view.bothBindtap).toBe(1)
      expect(stats.view.bothBindColonTap).toBe(0)
      expect(stats.view.bothReverseBindtap).toBe(1)
      expect(stats.view.bothReverseBindColonTap).toBe(0)

      expect(stats.nativeComponent.bindprobe).toBe(1)
      expect(stats.nativeComponent.bindColonProbe).toBe(1)
      expect(stats.nativeComponent.bothBindprobe).toBe(1)
      expect(stats.nativeComponent.bothBindColonProbe).toBe(0)
      expect(stats.nativeComponent.bothReverseBindprobe).toBe(1)
      expect(stats.nativeComponent.bothReverseBindColonProbe).toBe(0)

      expect(stats.wevuSfcComponent.bindprobe).toBe(1)
      expect(stats.wevuSfcComponent.bindColonProbe).toBe(1)
      expect(stats.wevuSfcComponent.bothBindprobe).toBe(1)
      expect(stats.wevuSfcComponent.bothBindColonProbe).toBe(0)
      expect(stats.wevuSfcComponent.bothReverseBindprobe).toBe(1)
      expect(stats.wevuSfcComponent.bothReverseBindColonProbe).toBe(0)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('verifies triggerEvent hyphen/underscore event names with bind and bind: forms', async () => {
    const miniProgram = await getSharedMiniProgram()
    try {
      const page = await miniProgram.reLaunch('/pages/components/index?from=e2e-event-name-binding')
      if (!page) {
        throw new Error('Failed to launch components page for triggerEvent event name verify')
      }
      await page.waitFor(500)
      await page.callMethod('resetNamedEventBindingStats')
      await page.waitFor(120)

      for (const eventNameType of ['hyphen', 'underscore'] as const) {
        for (const componentType of ['nativeComponent', 'wevuSfcComponent'] as const) {
          for (const bindingMode of ['bind', 'bindColon', 'both'] as const) {
            const triggered = await page.callMethod('triggerNamedComponentProbe', componentType, eventNameType, bindingMode)
            expect(triggered).toBe(true)
            await page.waitFor(120)
          }
        }
      }

      await page.waitFor(180)
      const stats = await page.callMethod('getNamedEventBindingStats') as NamedEventBindingStats
      expect(stats.hyphen.nativeComponent.bind).toBe(0)
      expect(stats.hyphen.nativeComponent.bindColon).toBe(1)
      expect(stats.hyphen.nativeComponent.bothBind).toBe(0)
      expect(stats.hyphen.nativeComponent.bothBindColon).toBe(1)
      expect(stats.hyphen.wevuSfcComponent.bind).toBe(0)
      expect(stats.hyphen.wevuSfcComponent.bindColon).toBe(1)
      expect(stats.hyphen.wevuSfcComponent.bothBind).toBe(0)
      expect(stats.hyphen.wevuSfcComponent.bothBindColon).toBe(1)

      expect(stats.underscore.nativeComponent.bind).toBe(1)
      expect(stats.underscore.nativeComponent.bindColon).toBe(1)
      expect(stats.underscore.nativeComponent.bothBind).toBe(1)
      expect(stats.underscore.nativeComponent.bothBindColon).toBe(0)
      expect(stats.underscore.wevuSfcComponent.bind).toBe(1)
      expect(stats.underscore.wevuSfcComponent.bindColon).toBe(1)
      expect(stats.underscore.wevuSfcComponent.bothBind).toBe(1)
      expect(stats.underscore.wevuSfcComponent.bothBindColon).toBe(0)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
