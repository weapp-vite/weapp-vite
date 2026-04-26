import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import {
  DIST_ROOT,
  launchFreshMiniProgram,
  readPageWxml,
  relaunchPage,
  waitForCurrentPagePath,
} from './github-issues.runtime.shared'

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

async function waitForIssue373Runtime(page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await page.callMethod('_runE2E')
      if (runtime?.count >= 1 && runtime?.doubled >= 2) {
        return runtime
      }
    }
    catch {
    }

    try {
      await page.waitFor(220)
    }
    catch {
    }
  }

  return null
}

async function callPageMethodWithTimeout(page: any, method: string, timeoutMs = 1_500) {
  return await Promise.race([
    page.callMethod(method),
    new Promise<null>((resolve) => {
      setTimeout(resolve, timeoutMs, null)
    }),
  ])
}

async function waitForIssue380Runtime(page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callPageMethodWithTimeout(page, '_runE2E')
      if (runtime?.hasTabBar && runtime?.tabBarRuntime?.ready) {
        return runtime
      }
    }
    catch {
    }

    try {
      await page.waitFor(220)
    }
    catch {
    }
  }

  return null
}

async function waitForIssue385Runtime(page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callPageMethodWithTimeout(page, '_runE2E')
      if (runtime?.layoutName === 'default' && runtime?.componentAttachCount !== null) {
        return runtime
      }
    }
    catch {
    }

    try {
      await page.waitFor(220)
    }
    catch {
    }
  }

  return null
}

async function waitForIssue398LayoutContent(page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callPageMethodWithTimeout(page, '_runE2E')
      const wxml = await readPageWxml(page)
      if (
        runtime?.navbarMounted
        && runtime?.footerMounted
        && runtime?.navbarLabel === 'issue-398 navbar'
        && runtime?.footerLabel === 'issue-398 footer'
        && wxml.includes('weapp-layout-issue-398-shell')
        && wxml.includes('basenavbar')
        && wxml.includes('basefooter')
        && wxml.includes('issue-398-page__marker')
      ) {
        return {
          runtime,
          wxml,
        }
      }
    }
    catch {
    }

    try {
      await page.waitFor(220)
    }
    catch {
    }
  }

  return null
}

async function waitForIssue404HookReady(page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callPageMethodWithTimeout(page, '_runE2E')
      if (runtime?.hasInstanceOnPageScroll) {
        return runtime
      }
    }
    catch {
    }

    try {
      await page.waitFor(220)
    }
    catch {
    }
  }

  return null
}

async function waitForIssue404ScrollRuntime(page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callPageMethodWithTimeout(page, '_runE2E')
      if (
        runtime?.hasInstanceOnPageScroll
        && Array.isArray(runtime?.scrollLogs)
        && runtime.scrollLogs.some((value: number) => value > 0)
        && Number(runtime?.latestScrollTop ?? -1) > 0
      ) {
        return runtime
      }
    }
    catch {
    }

    try {
      await page.waitFor(220)
    }
    catch {
    }
  }

  return null
}

async function waitForIssue418419Runtime(page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callPageMethodWithTimeout(page, '_runE2E')
      if (
        runtime?.ok
        && runtime?.mounted
        && runtime?.nativeButtonReady
        && runtime?.descriptorConfigurable === true
        && runtime?.hasDataObject
      ) {
        return runtime
      }
    }
    catch {
    }

    try {
      await page.waitFor(220)
    }
    catch {
    }
  }

  return null
}

async function waitForIssue446Runtime(page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callPageMethodWithTimeout(page, '_runE2E')
      if (
        runtime?.ok
        && runtime?.mounted
        && runtime?.nativeAnchorReady
        && runtime?.componentReady
        && runtime?.componentSnapshot?.visible === true
        && runtime?.componentSnapshot?.fooBar === 'issue-446-short-bind'
      ) {
        return runtime
      }
    }
    catch {
    }

    try {
      await page.waitFor(220)
    }
    catch {
    }
  }

  return null
}

async function waitForIssue479PullRuntime(page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callPageMethodWithTimeout(page, '_runE2E')
      if (runtime?.hasPull) {
        return runtime
      }
    }
    catch {
    }

    try {
      await page.waitFor(220)
    }
    catch {
    }
  }

  return null
}

async function waitForIssue479BottomRuntime(page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callPageMethodWithTimeout(page, '_runE2E')
      if (runtime?.hasBottom) {
        return runtime
      }
    }
    catch {
    }

    try {
      await page.waitFor(220)
    }
    catch {
    }
  }

  return null
}

async function waitForIssue479Ready(page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callPageMethodWithTimeout(page, '_runE2E')
      if (Array.isArray(runtime?.logs)) {
        return runtime
      }
    }
    catch {
    }

    try {
      await page.waitFor(220)
    }
    catch {
    }
  }

  return null
}

describe.sequential('e2e app: github-issues / lifecycle', () => {
  afterAll(async () => {
    await cleanupResidualIdeProcesses()
  })

  it('issue #309: triggers onLoad without requiring onPullDownRefresh hook', async (ctx) => {
    const miniProgram = await launchFreshMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-309/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-309 page')
      }
      const runtimeResult = await issuePage.callMethod('_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.loadCount).toBeGreaterThanOrEqual(1)
      expect(await issuePage.data('loadCount')).toBeGreaterThanOrEqual(1)
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })

  it('issue #309: triggers onLoad with created setupLifecycle and no pull-down hook', async (ctx) => {
    const miniProgram = await launchFreshMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-309-created/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-309-created page')
      }
      const runtimeResult = await issuePage.callMethod('_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.loadCount).toBeGreaterThanOrEqual(1)
      expect(await issuePage.data('loadCount')).toBeGreaterThanOrEqual(1)
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })

  it('issue #312: updates computed object bindings after switching back to initial reference', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-312/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-312/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-312 computed object round trip')
    expect(issuePageWxml).toContain('issue312-btn-inc')
    expect(issuePageWxml).toContain('issue312-btn-dec')
    expect(issuePageJs).toContain('_runE2E')

    const miniProgram = await launchFreshMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-312/index', 'data-current-label="选项1"')
      if (!issuePage) {
        throw new Error('Failed to launch issue-312 page')
      }
      const initialRuntime = await issuePage.callMethod('_runE2E')
      expect(initialRuntime?.ok).toBe(true)
      expect(initialRuntime?.index).toBe(0)
      expect(initialRuntime?.label).toBe('选项1')
      expect(await issuePage.data('index')).toBe(0)
      const initialWxml = await readPageWxml(issuePage)
      expect(initialWxml).toContain('data-current-label="选项1"')
      expect(initialWxml).toContain('data-current-index="0"')

      await issuePage.callMethod('inc')
      await issuePage.waitFor(240)
      const afterIncRuntime = await issuePage.callMethod('_runE2E')
      expect(afterIncRuntime?.ok).toBe(true)
      expect(afterIncRuntime?.index).toBe(1)
      expect(afterIncRuntime?.label).toBe('选项2')

      await issuePage.callMethod('dec')
      await issuePage.waitFor(240)
      const afterDecRuntime = await issuePage.callMethod('_runE2E')
      expect(afterDecRuntime?.ok).toBe(true)
      expect(afterDecRuntime?.index).toBe(0)
      expect(afterDecRuntime?.label).toBe('选项1')
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })

  it('issue #316: triggers kebab-case component event bindings at runtime', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-316/index.wxml')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    expect(issuePageWxml).toContain('issue-316 hyphen event binding')
    expect(issuePageWxml).toContain('bind:overlay-click="__weapp_vite_inline"')
    expect(issuePageWxml).not.toContain('bindoverlay-click=')

    const miniProgram = await launchFreshMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-316/index', 'overlay clicks: 0')
      if (!issuePage) {
        throw new Error('Failed to launch issue-316 page')
      }
      const emitterHost = await issuePage.$('.issue316-emitter-host')
      if (!emitterHost) {
        throw new Error('Failed to find issue-316 emitter host')
      }
      await emitterHost.dispatchEvent({ eventName: 'overlay-click' })
      await issuePage.waitFor(240)
      const renderedWxml = await readPageWxml(issuePage)
      expect(renderedWxml).toContain('overlay clicks: 1')
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })

  it('issue #318: keeps template call-expression rendering stable with auto setData.pick', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-318/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-318/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    expect(issuePageWxml).toContain('issue-318 auto setData pick from template')
    expect(issuePageJs).toContain('_runE2E')

    const miniProgram = await launchFreshMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-318/index', 'count: 1')
      if (!issuePage) {
        throw new Error('Failed to launch issue-318 page')
      }
      await issuePage.callMethod('incCount')
      await issuePage.waitFor(220)
      await issuePage.callMethod('appendRow')
      await issuePage.waitFor(220)
      await issuePage.callMethod('cycleActive')
      await issuePage.waitFor(220)
      const renderedWxml = await readPageWxml(issuePage)
      expect(renderedWxml).toContain('count: 2')
      expect(renderedWxml).toContain('size: 3')
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })

  it('issue #320: supports runtime addRoute alias and redirect navigation', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-320/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-320/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    expect(issuePageWxml).toContain('issue-320 dynamic route alias + redirect')
    expect(issuePageJs).toContain('runRedirectNavigationE2E')

    const miniProgram = await launchFreshMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-320/index', 'ready for runtime e2e')
      if (!issuePage) {
        throw new Error('Failed to launch issue-320 page')
      }
      const navigationResult = await issuePage.callMethod('runRedirectNavigationE2E')
      expect(navigationResult?.ok).toBe(true)
      const redirectedPage = await waitForCurrentPagePath(miniProgram, '/pages/issue-309/index')
      expect(redirectedPage).toBeTruthy()
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })

  it('issue #380: keeps custom tab bar out of default layout at runtime', async (ctx) => {
    const miniProgram = await launchFreshMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-380/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-380 page')
      }
      const runtimeResult = await waitForIssue380Runtime(issuePage)
      expect(runtimeResult?.hasTabBar).toBe(true)
      expect(runtimeResult?.tabBarRuntime?.ready).toBe(true)
      expect(runtimeResult?.tabBarRuntime?.layoutWrapperDetected).toBe(false)
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })

  it('issue #385: does not attach the page component twice after setPageLayout("default")', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-385/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-385/index.js')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('<attach-probe id="attach-probe" />')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('componentAttachCount')

    const miniProgram = await launchFreshMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-385/index', 'attach-probe')
      if (!issuePage) {
        throw new Error('Failed to launch issue-385 page')
      }

      const runtimeResult = await waitForIssue385Runtime(issuePage, 30_000)
      expect(runtimeResult?.layoutName).toBe('default')
      expect(runtimeResult?.componentAttachCount).toBe(1)
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })

  it('issue #398: keeps layout child components mounted through the shared wevu runtime path', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-398/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-398/index.js')
    const navbarJsPath = path.join(DIST_ROOT, 'components/issue-398/BaseNavbar/index.js')
    const footerJsPath = path.join(DIST_ROOT, 'components/issue-398/BaseFooter/index.js')

    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('{{issue398PageMarker}}')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('_runE2E')
    expect(await fs.readFile(navbarJsPath, 'utf-8')).toContain('issue-398 navbar')
    expect(await fs.readFile(footerJsPath, 'utf-8')).toContain('issue-398 footer')

    const miniProgram = await launchFreshMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-398/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-398 page')
      }

      const layoutResult = await waitForIssue398LayoutContent(issuePage)
      expect(layoutResult).toBeTruthy()
      expect(layoutResult?.wxml).toContain('weapp-layout-issue-398-shell')
      expect(layoutResult?.wxml).toContain('basenavbar')
      expect(layoutResult?.wxml).toContain('basefooter')

      const runtimeResult = layoutResult?.runtime ?? await issuePage.callMethod('_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.pageMarker).toBe('issue-398-page-initial')
      expect(runtimeResult?.title).toBe('issue-398 hmr shared chunk')
      expect(runtimeResult?.navbarMounted).toBe(true)
      expect(runtimeResult?.footerMounted).toBe(true)
      expect(runtimeResult?.navbarLabel).toBe('issue-398 navbar')
      expect(runtimeResult?.footerLabel).toBe('issue-398 footer')
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })

  it('issue #404: exposes page.onPageScroll on the runtime instance and receives page scroll updates', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-404/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-404/index.js')

    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('issue-404 onPageScroll bridge')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('_runE2E')

    const miniProgram = await launchFreshMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-404/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-404 page')
      }

      const initialRuntime = await waitForIssue404HookReady(issuePage)
      expect(initialRuntime?.hasInstanceOnPageScroll).toBe(true)

      await miniProgram.pageScrollTo(960)
      await issuePage.waitFor(240)

      const runtimeResult = await waitForIssue404ScrollRuntime(issuePage)
      expect(runtimeResult?.hasInstanceOnPageScroll).toBe(true)
      expect(Array.isArray(runtimeResult?.scrollLogs)).toBe(true)
      expect(runtimeResult?.scrollLogs?.some((value: number) => value > 0)).toBe(true)
      expect(Number(runtimeResult?.latestScrollTop ?? -1)).toBeGreaterThan(0)
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })

  it('issue #418/#419: keeps third-party component template refs available in DevTools runtime', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-418-419/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-418-419/index.js')
    const issuePageJsonPath = path.join(DIST_ROOT, 'pages/issue-418-419/index.json')

    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('issue-418-419 template ref native component')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('native ref ready')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('_runE2E')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('descriptorConfigurable')
    expect(await fs.readFile(issuePageJsonPath, 'utf-8')).toContain('../../components/issue-418-419/NativeRefProbe/index')

    const miniProgram = await launchFreshMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-418-419/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-418-419 page')
      }

      const runtimeResult = await waitForIssue418419Runtime(issuePage)
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.mounted).toBe(true)
      expect(runtimeResult?.nativeButtonReady).toBe(true)
      expect(runtimeResult?.descriptorConfigurable).toBe(true)
      expect(runtimeResult?.hasDataObject).toBe(true)
      expect(runtimeResult?.runtimeError).toBeNull()
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })

  it('issue #446: keeps template refs and shortBind props available in DevTools runtime', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-446/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-446/index.js')
    const issuePageJsonPath = path.join(DIST_ROOT, 'pages/issue-446/index.json')

    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('issue-446 template ref and shortBind')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('visible="{{visible}}"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('foo-bar="{{fooBar}}"')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('_runE2E')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('issue-446-short-bind')
    expect(await fs.readFile(issuePageJsonPath, 'utf-8')).toContain('"ShortBindProbe": "/components/issue-446/ShortBindProbe/index"')

    const miniProgram = await launchFreshMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-446/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-446 page')
      }

      const runtimeResult = await waitForIssue446Runtime(issuePage)
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.mounted).toBe(true)
      expect(runtimeResult?.nativeAnchorReady).toBe(true)
      expect(runtimeResult?.componentReady).toBe(true)
      expect(runtimeResult?.shortBindVisible).toBe(true)
      expect(runtimeResult?.shortBindFooBar).toBe('issue-446-short-bind')
      expect(runtimeResult?.componentSnapshot).toEqual({
        visible: true,
        fooBar: 'issue-446-short-bind',
        summary: 'visible:issue-446-short-bind',
      })
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })

  it('issue #479: triggers indirect pull-down hook in DevTools runtime', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-479/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-479/index.js')
    const issuePageJsonPath = path.join(DIST_ROOT, 'pages/issue-479/index.json')

    const miniProgram = await launchFreshMiniProgram(ctx)
    const consoleEntries: string[] = []
    const onConsole = (entry: any) => {
      const text = normalizeConsoleText(entry)
      if (text.includes('[issue-479]')) {
        consoleEntries.push(text)
      }
    }

    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('issue-479 indirect page feature hooks')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('enableOnPullDownRefresh: true')
    expect(await fs.readFile(issuePageJsonPath, 'utf-8')).toContain('"enablePullDownRefresh": true')

    miniProgram.on('console', onConsole)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-479/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-479 page')
      }
      const initialRuntime = await waitForIssue479Ready(issuePage)
      expect(Array.isArray(initialRuntime?.logs)).toBe(true)

      await miniProgram.callWxMethod('startPullDownRefresh')
      await issuePage.waitFor(300)

      const runtimeResult = await waitForIssue479PullRuntime(issuePage)
      expect(runtimeResult?.hasPull).toBe(true)
      expect(runtimeResult?.logs).toContain('pull')
      expect(runtimeResult?.hasBottom).toBe(false)
      expect(consoleEntries.some(entry => entry.includes('[issue-479] onPullDownRefresh'))).toBe(true)
    }
    finally {
      miniProgram.removeListener('console', onConsole)
      await miniProgram.close().catch(() => {})
    }
  })

  it('issue #479: triggers indirect reach-bottom hook through Component page method bridge', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-479/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-479/index.js')
    const issuePageJsonPath = path.join(DIST_ROOT, 'pages/issue-479/index.json')

    const miniProgram = await launchFreshMiniProgram(ctx)
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('issue-479 indirect page feature hooks')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('enableOnReachBottom: true')
    expect(await fs.readFile(issuePageJsonPath, 'utf-8')).toContain('"onReachBottomDistance": 50')

    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-479/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-479 page')
      }
      const initialRuntime = await waitForIssue479Ready(issuePage)
      expect(Array.isArray(initialRuntime?.logs)).toBe(true)

      await issuePage.callMethod('onReachBottom')
      await issuePage.waitFor(300)

      const runtimeResult = await waitForIssue479BottomRuntime(issuePage)
      expect(runtimeResult?.hasBottom).toBe(true)
      expect(runtimeResult?.logs).toContain('bottom')
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })

  it('experiment: block nodes can provide named and default slot content in DevTools runtime', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/block-slot/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/block-slot/index.js')
    const issuePageJsonPath = path.join(DIST_ROOT, 'pages/block-slot/index.json')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/block-slot-host/index.wxml')

    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('<block slot="header">')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('toggleLabels')
    expect(await fs.readFile(issuePageJsonPath, 'utf-8')).toContain('"block-slot-host": "../../components/block-slot-host/index"')
    expect(await fs.readFile(componentWxmlPath, 'utf-8')).toContain('<slot name="header"></slot>')

    const miniProgram = await launchFreshMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/block-slot/index', 'header slot via block: ready')
      if (!issuePage) {
        throw new Error('Failed to launch block-slot page')
      }

      const initialRuntime = await issuePage.callMethod('_runE2E')
      expect(initialRuntime?.ok).toBe(true)
      expect(initialRuntime?.headerLabel).toBe('ready')
      expect(initialRuntime?.bodyLabel).toBe('alpha')

      const initialWxml = await readPageWxml(issuePage)
      expect(initialWxml).toContain('data-slot-header="host"')
      expect(initialWxml).toContain('header slot via block: ready')
      expect(initialWxml).toContain('header extra')
      expect(initialWxml).toContain('data-slot-content="host"')
      expect(initialWxml).toContain('default slot via block: alpha')

      await issuePage.callMethod('toggleLabels')
      await issuePage.waitFor(260)

      const updatedRuntime = await issuePage.callMethod('_runE2E')
      expect(updatedRuntime?.headerLabel).toBe('updated')
      expect(updatedRuntime?.bodyLabel).toBe('beta')

      const updatedWxml = await readPageWxml(issuePage)
      expect(updatedWxml).toContain('header slot via block: updated')
      expect(updatedWxml).toContain('default slot via block: beta')
      expect(updatedWxml).not.toContain('header slot via block: ready')
      expect(updatedWxml).not.toContain('default slot via block: alpha')
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })

  it('issue #494: plain template v-slot content unwraps to child slot attrs or block wrappers in DevTools runtime', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-494/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-494/index.js')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/issue-494/SlotHost/index.wxml')

    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('slot="icon"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('<view slot="header"><view class="issue494-header-probe"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).not.toContain('<view slot="icon">')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).not.toContain('<block slot="header">')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('toggleLabels')
    expect(await fs.readFile(componentWxmlPath, 'utf-8')).toContain('<slot name="icon" />')

    const miniProgram = await launchFreshMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-494/index', 'header via template slot: ready')
      if (!issuePage) {
        throw new Error('Failed to launch issue-494 page')
      }

      const initialRuntime = await issuePage.callMethod('_runE2E')
      expect(initialRuntime?.ok).toBe(true)
      expect(initialRuntime?.headerLabel).toBe('ready')
      expect(initialRuntime?.bodyLabel).toBe('alpha')
      expect(initialRuntime?.iconSrc).toBe('https://static.example.com/issue-494/icon.png')

      const initialWxml = await readPageWxml(issuePage)
      expect(initialWxml).toContain('data-slot-icon="host"')
      expect(initialWxml).toContain('data-probe="single-image"')
      expect(initialWxml).toContain('issue494-icon-probe')
      expect(initialWxml).toContain('data-slot-header="host"')
      expect(initialWxml).toContain('header via template slot: ready')
      expect(initialWxml).toContain('header extra')
      expect(initialWxml).toContain('data-slot-content="host"')
      expect(initialWxml).toContain('default via template slot: alpha')

      await issuePage.callMethod('toggleLabels')
      await issuePage.waitFor(260)

      const updatedRuntime = await issuePage.callMethod('_runE2E')
      expect(updatedRuntime?.headerLabel).toBe('updated')
      expect(updatedRuntime?.bodyLabel).toBe('beta')

      const updatedWxml = await readPageWxml(issuePage)
      expect(updatedWxml).toContain('header via template slot: updated')
      expect(updatedWxml).toContain('default via template slot: beta')
      expect(updatedWxml).not.toContain('header via template slot: ready')
      expect(updatedWxml).not.toContain('default via template slot: alpha')
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })

  it('issue #500: missing inject warns without blocking later setup code in DevTools runtime', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-500/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-500/index.js')

    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('issue-500 inject missing key continuation')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('issue-500:missing-token')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('_runE2E')

    const miniProgram = await launchFreshMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-500/index', 'inject after line: continued')
      if (!issuePage) {
        throw new Error('Failed to launch issue-500 page')
      }

      const runtime = await issuePage.callMethod('_runE2E')
      expect(runtime?.ok).toBe(true)
      expect(runtime?.continuationText).toBe('continued')
      expect(runtime?.missingType).toBe('undefined')

      const wxml = await readPageWxml(issuePage)
      expect(wxml).toContain('data-continuation="continued"')
      expect(wxml).toContain('data-missing-type="undefined"')
      expect(wxml).toContain('inject after line: continued')
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })

  it('experiment: flex parent keeps projected multi-node slot groups visible in DevTools runtime', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/slot-flex-layout/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/slot-flex-layout/index.js')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/slot-flex-host/index.wxml')

    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('slot flex layout experiment')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('<view slot="middle"><view class="slot-flex-item slot-flex-item--middle-multi-center-a"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).not.toContain('<block slot="middle">')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).not.toContain('_runE2E')
    expect(await fs.readFile(componentWxmlPath, 'utf-8')).toContain('<slot name="left" />')

    const miniProgram = await launchFreshMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/slot-flex-layout/index', 'slot flex layout experiment')
      if (!issuePage) {
        throw new Error('Failed to launch slot-flex-layout page')
      }

      const initialWxml = await readPageWxml(issuePage)
      expect(initialWxml).toContain('single-per-slot')
      expect(initialWxml).toContain('middle-multi')
      expect(initialWxml).toContain('all-multi')
      expect(initialWxml).toContain('data-case="single-left"')
      expect(initialWxml).toContain('data-case="single-middle"')
      expect(initialWxml).toContain('data-case="single-right"')
      expect(initialWxml).toContain('data-case="middle-multi-left"')
      expect(initialWxml).toContain('data-case="middle-multi-center-a"')
      expect(initialWxml).toContain('data-case="middle-multi-center-b"')
      expect(initialWxml).toContain('data-case="middle-multi-right"')
      expect(initialWxml).toContain('data-case="all-multi-left-a"')
      expect(initialWxml).toContain('data-case="all-multi-left-b"')
      expect(initialWxml).toContain('data-case="all-multi-middle-a"')
      expect(initialWxml).toContain('data-case="all-multi-middle-b"')
      expect(initialWxml).toContain('data-case="all-multi-right-a"')
      expect(initialWxml).toContain('data-case="all-multi-right-b"')
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })

  it('experiment: native self-closing and paired slot tags render equivalently in DevTools runtime', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/slot-tag-form/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/slot-tag-form/index.js')
    const selfHostWxmlPath = path.join(DIST_ROOT, 'components/slot-tag-self-host/index.wxml')
    const pairedHostWxmlPath = path.join(DIST_ROOT, 'components/slot-tag-paired-host/index.wxml')

    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('self header: {{sharedHeaderLabel}}')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('paired header: {{sharedHeaderLabel}}')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('toggleLabels')
    expect(await fs.readFile(selfHostWxmlPath, 'utf-8')).toContain('<slot name="header" />')
    expect(await fs.readFile(pairedHostWxmlPath, 'utf-8')).toContain('<slot name="header"></slot>')

    const miniProgram = await launchFreshMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/slot-tag-form/index', 'slot tag form experiment')
      if (!issuePage) {
        throw new Error('Failed to launch slot-tag-form page')
      }

      const initialRuntime = await issuePage.callMethod('_runE2E')
      expect(initialRuntime?.ok).toBe(true)
      expect(initialRuntime?.sharedHeaderLabel).toBe('ready')
      expect(initialRuntime?.sharedBodyLabel).toBe('alpha')

      const initialWxml = await readPageWxml(issuePage)
      expect(initialWxml).toContain('data-slot-host="self-header"')
      expect(initialWxml).toContain('self header: ready')
      expect(initialWxml).toContain('data-slot-host="self-default"')
      expect(initialWxml).toContain('self body: alpha')
      expect(initialWxml).toContain('data-slot-host="paired-header"')
      expect(initialWxml).toContain('paired header: ready')
      expect(initialWxml).toContain('data-slot-host="paired-default"')
      expect(initialWxml).toContain('paired body: alpha')

      await issuePage.callMethod('toggleLabels')
      await issuePage.waitFor(260)

      const updatedRuntime = await issuePage.callMethod('_runE2E')
      expect(updatedRuntime?.sharedHeaderLabel).toBe('updated')
      expect(updatedRuntime?.sharedBodyLabel).toBe('beta')

      const updatedWxml = await readPageWxml(issuePage)
      expect(updatedWxml).toContain('self header: updated')
      expect(updatedWxml).toContain('self body: beta')
      expect(updatedWxml).toContain('paired header: updated')
      expect(updatedWxml).toContain('paired body: beta')
      expect(updatedWxml).not.toContain('self header: ready')
      expect(updatedWxml).not.toContain('paired header: ready')
      expect(updatedWxml).not.toContain('self body: alpha')
      expect(updatedWxml).not.toContain('paired body: alpha')
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })

  it('issue #373: keeps shared store computed reactive after reLaunch tears down the first page', async (ctx) => {
    const launchPageWxmlPath = path.join(DIST_ROOT, 'pages/issue-373/launch/index.wxml')
    const resultPageWxmlPath = path.join(DIST_ROOT, 'pages/issue-373/result/index.wxml')
    const launchPageJsPath = path.join(DIST_ROOT, 'pages/issue-373/launch/index.js')
    const resultPageJsPath = path.join(DIST_ROOT, 'pages/issue-373/result/index.js')

    expect(await fs.readFile(launchPageWxmlPath, 'utf-8')).toContain('issue-373 store computed survives reLaunch')
    expect(await fs.readFile(resultPageWxmlPath, 'utf-8')).toContain('issue-373 reLaunch store computed result')
    expect(await fs.readFile(launchPageJsPath, 'utf-8')).toContain('runRelaunch')
    expect(await fs.readFile(resultPageJsPath, 'utf-8')).toContain('increment')

    const miniProgram = await launchFreshMiniProgram(ctx)
    try {
      const launchPage = await relaunchPage(miniProgram, '/pages/issue-373/launch/index')
      if (!launchPage) {
        throw new Error('Failed to launch issue-373 launch page')
      }
      const launchRuntime = await waitForIssue373Runtime(launchPage)
      expect(launchRuntime?.ok).toBe(true)
      expect(launchRuntime?.count).toBe(1)
      expect(launchRuntime?.doubled).toBe(2)

      await launchPage.callMethod('runRelaunch')
      const resultPage = await waitForCurrentPagePath(miniProgram, '/pages/issue-373/result/index', 20_000)
      if (!resultPage) {
        throw new Error('Failed to navigate to issue-373 result page via reLaunch')
      }
      const initialResultWxml = await readPageWxml(resultPage)
      expect(initialResultWxml).toContain('data-count="1"')
      expect(initialResultWxml).toContain('data-doubled="2"')

      await resultPage.callMethod('increment')
      await resultPage.waitFor(260)
      const runtimeResult = await resultPage.callMethod('_runE2E')
      expect(runtimeResult?.count).toBe(2)
      expect(runtimeResult?.doubled).toBe(4)
      expect(runtimeResult?.ok).toBe(true)

      const updatedWxml = await readPageWxml(resultPage)
      expect(updatedWxml).toContain('data-count="2"')
      expect(updatedWxml).toContain('data-doubled="4"')
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  })
})
