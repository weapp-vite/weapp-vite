import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
  waitForCurrentPagePath,
} from './github-issues.runtime.shared'

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

describe.sequential('e2e app: github-issues / lifecycle', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('issue #309: triggers onLoad without requiring onPullDownRefresh hook', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
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
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #309: triggers onLoad with created setupLifecycle and no pull-down hook', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
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
      await releaseSharedMiniProgram(miniProgram)
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

    const miniProgram = await getSharedMiniProgram(ctx)
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
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #316: triggers kebab-case component event bindings at runtime', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-316/index.wxml')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    expect(issuePageWxml).toContain('issue-316 hyphen event binding')
    expect(issuePageWxml).toContain('bind:overlay-click="__weapp_vite_inline"')
    expect(issuePageWxml).not.toContain('bindoverlay-click=')

    const miniProgram = await getSharedMiniProgram(ctx)
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
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #318: keeps template call-expression rendering stable with auto setData.pick', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-318/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-318/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    expect(issuePageWxml).toContain('issue-318 auto setData pick from template')
    expect(issuePageJs).toContain('_runE2E')

    const miniProgram = await getSharedMiniProgram(ctx)
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
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #320: supports runtime addRoute alias and redirect navigation', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-320/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-320/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    expect(issuePageWxml).toContain('issue-320 dynamic route alias + redirect')
    expect(issuePageJs).toContain('runRedirectNavigationE2E')

    const miniProgram = await getSharedMiniProgram(ctx)
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
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #380: keeps custom tab bar out of default layout at runtime', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
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
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #385: does not attach the page component twice after setPageLayout("default")', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-385/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-385/index.js')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('<attach-probe id="attach-probe" />')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('componentAttachCount')

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-385/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-385 page')
      }

      const runtimeResult = await waitForIssue385Runtime(issuePage)
      expect(runtimeResult?.layoutName).toBe('default')
      expect(runtimeResult?.componentAttachCount).toBe(1)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
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

    const miniProgram = await getSharedMiniProgram(ctx)
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
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #404: exposes page.onPageScroll on the runtime instance and receives page scroll updates', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-404/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-404/index.js')

    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('issue-404 onPageScroll bridge')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('_runE2E')

    const miniProgram = await getSharedMiniProgram(ctx)
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
      await releaseSharedMiniProgram(miniProgram)
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

    const miniProgram = await getSharedMiniProgram(ctx)
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
      await releaseSharedMiniProgram(miniProgram)
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

    const miniProgram = await getSharedMiniProgram(ctx)
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
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
