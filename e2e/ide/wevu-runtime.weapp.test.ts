import { describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import {
  APP_ROOT,
  filterSnapshotPages,
  formatMarkup,
  loadAppConfig,
  normalizeAutomatorWxml,
  resolvePages,
  runBuild,
} from '../wevu-runtime.utils'

function resolveConsolePayload(entry: any) {
  if (entry && typeof entry === 'object' && entry.entry && typeof entry.entry === 'object') {
    return entry.entry
  }
  if (entry && typeof entry === 'object' && entry.message && typeof entry.message === 'object') {
    return entry.message
  }
  if (entry && typeof entry === 'object' && entry.params && typeof entry.params === 'object') {
    return entry.params
  }
  return entry
}

function normalizeConsoleText(entry: any) {
  const payload = resolveConsolePayload(entry)
  if (typeof payload?.text === 'string' && payload.text.trim()) {
    return payload.text.trim()
  }
  if (Array.isArray(payload?.args) && payload.args.length > 0) {
    const text = payload.args
      .map((item: any) => {
        const raw = item && typeof item === 'object' && 'value' in item ? item.value : item
        return typeof raw === 'string' ? raw : String(raw)
      })
      .join(' ')
      .trim()
    if (text) {
      return text
    }
  }
  return String(entry ?? '')
}

async function waitForTruthy<T>(getter: () => Promise<T | null>, timeoutMs = 6_000, intervalMs = 120) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    const current = await getter()
    if (current) {
      return current
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  return null
}

function getPageOrder(pages: string[]) {
  return filterSnapshotPages(pages)
}

describe.sequential('wevu runtime (weapp e2e)', () => {
  it('runs all pages and snapshots WXML', async () => {
    const config = await loadAppConfig()
    const pages = getPageOrder(resolvePages(config))

    await runBuild('weapp')

    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })

    try {
      for (const pagePath of pages) {
        const route = `/${pagePath}`
        const page = await miniProgram.reLaunch(route)
        if (!page) {
          throw new Error(`Failed to launch page: ${route}`)
        }

        const result = await page.callMethod('runE2E')
        if (!result?.ok) {
          throw new Error(`E2E failed for ${pagePath}: ${JSON.stringify(result)}`)
        }
        expect(result.ok).toBe(true)

        const element = await page.$('page')
        if (!element) {
          throw new Error(`Missing page element for ${route}`)
        }
        const wxml = normalizeAutomatorWxml(await element.wxml())
        expect(await formatMarkup(wxml)).toMatchSnapshot(`wevu-runtime::${pagePath}`)
      }
    }
    finally {
      await miniProgram.close()
    }
  })

  it('triggers page scroll and prints debug console logs', async () => {
    await runBuild('weapp')

    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })

    const consoleEntries: string[] = []
    const onConsole = (entry: any) => {
      const text = normalizeConsoleText(entry)
      if (text.includes('[runtime-scroll-debug]')) {
        consoleEntries.push(text)
      }
    }

    miniProgram.on('console', onConsole)
    try {
      const page = await miniProgram.reLaunch('/pages/runtime/index')
      if (!page) {
        throw new Error('Failed to launch /pages/runtime/index')
      }

      await page.waitFor(200)
      await miniProgram.pageScrollTo(1200)
      await page.waitFor(180)
      await miniProgram.pageScrollTo(1800)
      await page.waitFor(220)

      const scrollLogs = await waitForTruthy(async () => {
        const logs = await page.callMethod('getScrollDebugLogs')
        return Array.isArray(logs) && logs.length > 0 ? logs : null
      })

      if (!scrollLogs) {
        throw new Error('Expected runtime scroll debug logs, but none were produced')
      }

      const hookLogs = await page.data('hookLogs')
      expect(Array.isArray(hookLogs)).toBe(true)
      expect(hookLogs).toContain('onPageScroll')
      expect(scrollLogs.some((item: any) => Number(item?.scrollTop ?? -1) > 0)).toBe(true)

      const consoleMatches = await waitForTruthy(async () => {
        return consoleEntries.length > 0 ? consoleEntries.slice() : null
      })
      expect(consoleMatches).not.toBeNull()
      expect(consoleMatches?.some(item => item.includes('[runtime-scroll-debug]'))).toBe(true)
    }
    finally {
      miniProgram.removeListener('console', onConsole)
      await miniProgram.close()
    }
  })
})
