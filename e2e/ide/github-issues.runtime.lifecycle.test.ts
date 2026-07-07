import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  callRoutePageMethod,
  callRoutePageMethodWithOptions,
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
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

async function waitForIssue385Runtime(page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await page.callMethod('_runE2E')
      if (runtime?.layoutName === 'default' && runtime?.componentAttachCount !== null) {
        return runtime
      }
    }
    catch {
    }

    try {
      await delay(220)
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
      const runtime = await page.callMethod('_runE2E')
      if (
        runtime?.navbarMounted
        && runtime?.footerMounted
        && runtime?.navbarLabel === 'issue-398 navbar'
        && runtime?.footerLabel === 'issue-398 footer'
      ) {
        return {
          runtime,
        }
      }
    }
    catch {
    }

    try {
      await delay(220)
    }
    catch {
    }
  }

  return null
}

async function waitForIssue404HookReady(miniProgram: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callRoutePageMethod(miniProgram, '/pages/issue-404/index', '_runE2E')
      if (runtime?.hasInstanceOnPageScroll) {
        return runtime
      }
    }
    catch {
    }

    try {
      await delay(220)
    }
    catch {
    }
  }

  return null
}

async function waitForIssue404ScrollRuntime(miniProgram: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callRoutePageMethod(miniProgram, '/pages/issue-404/index', '_runE2E')
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
      await delay(220)
    }
    catch {
    }
  }

  return null
}

async function waitForIssue418419Runtime(miniProgram: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callRoutePageMethod(miniProgram, '/pages/issue-418-419/index', '_runE2E')
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
      await delay(220)
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
      const runtime = await page.callMethod('_runE2E')
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
      await delay(220)
    }
    catch {
    }
  }

  return null
}

async function waitForIssue479PullRuntime(miniProgram: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callRoutePageMethod(miniProgram, '/pages/issue-479/index', '_runE2E')
      if (runtime?.hasPull) {
        return runtime
      }
    }
    catch {
    }

    try {
      await delay(220)
    }
    catch {
    }
  }

  return null
}

async function waitForIssue479BottomRuntime(miniProgram: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callRoutePageMethod(miniProgram, '/pages/issue-479/index', '_runE2E')
      if (runtime?.hasBottom) {
        return runtime
      }
    }
    catch {
    }

    try {
      await delay(220)
    }
    catch {
    }
  }

  return null
}

async function waitForIssue695PullRuntime(miniProgram: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callRoutePageMethod(miniProgram, '/pages/issue-695/index', '_runE2E')
      if (runtime?.hasPull) {
        return runtime
      }
    }
    catch {
    }

    try {
      await delay(220)
    }
    catch {
    }
  }

  return null
}

async function waitForIssue479Ready(miniProgram: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await callRoutePageMethod(miniProgram, '/pages/issue-479/index', '_runE2E')
      if (Array.isArray(runtime?.logs)) {
        return runtime
      }
    }
    catch {
    }

    try {
      await delay(220)
    }
    catch {
    }
  }

  return null
}

describe.sequential('e2e app: github-issues / lifecycle', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  }, 30_000)

  it('issue #309: triggers onLoad without requiring onPullDownRefresh hook', async (ctx) => {
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-309/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-309 page')
      }
      const activeMiniProgram = await getSharedMiniProgram(ctx)
      const runtimeResult = await callRoutePageMethod(activeMiniProgram, '/pages/issue-309/index', '_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.loadCount).toBeGreaterThanOrEqual(1)
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
      const activeMiniProgram = await getSharedMiniProgram(ctx)
      const runtimeResult = await callRoutePageMethod(activeMiniProgram, '/pages/issue-309-created/index', '_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.loadCount).toBeGreaterThanOrEqual(1)
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
      const issue312Readiness = async (page: any) => {
        await page.waitForRendered({
          selector: '#issue312-page',
          dataset: { e2eIssue: '312' },
          timeout: 4_000,
        })
        return true
      }
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-312/index', undefined, 45_000, {
        readiness: issue312Readiness,
      })
      if (!issuePage) {
        throw new Error('Failed to launch issue-312 page')
      }
      const initialRuntime = await callRoutePageMethodWithOptions(miniProgram, '/pages/issue-312/index', '_runE2E', {
        readiness: issue312Readiness,
      })
      expect(initialRuntime?.ok).toBe(true)
      expect(initialRuntime?.index).toBe(0)
      expect(initialRuntime?.label).toBe('选项1')

      const afterIncRuntime = await callRoutePageMethodWithOptions(miniProgram, '/pages/issue-312/index', '_runE2E', {
        readiness: issue312Readiness,
      }, 'inc')
      expect(afterIncRuntime?.ok).toBe(true)
      expect(afterIncRuntime?.index).toBe(1)
      expect(afterIncRuntime?.label).toBe('选项2')

      const afterDecRuntime = await callRoutePageMethodWithOptions(miniProgram, '/pages/issue-312/index', '_runE2E', {
        readiness: issue312Readiness,
      }, 'dec')
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
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-316/index', undefined, 45_000, {
        readiness: async (page) => {
          await page.waitForRendered({
            selector: '#issue316-page',
            dataset: { e2eIssue: '316' },
            timeout: 4_000,
          })
          return true
        },
      })
      if (!issuePage) {
        throw new Error('Failed to launch issue-316 page')
      }
      const runtime = await issuePage.callMethod('_runE2E', 'trigger')
      expect(runtime?.triggered).toBe(true)
      await issuePage.waitForRendered({
        selector: '#issue316-probe',
        dataset: { overlayCount: 1 },
        timeout: 8_000,
      })
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
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-318/index', undefined, 45_000, { readiness: 'route' })
      if (!issuePage) {
        throw new Error('Failed to launch issue-318 page')
      }
      const runtime = await callRoutePageMethod(miniProgram, '/pages/issue-318/index', '_runE2E', 'mutate')
      expect(runtime?.count).toBe(2)
      expect(runtime?.rows).toHaveLength(3)
      expect(runtime?.meta).toBe('meta-2-3')
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
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-320/index', undefined, 45_000, { readiness: 'route' })
      if (!issuePage) {
        throw new Error('Failed to launch issue-320 page')
      }
      const activeMiniProgram = await getSharedMiniProgram(ctx)
      const navigationResult = await issuePage.callMethod('runRedirectNavigationE2E')
      expect(navigationResult?.ok).toBe(true)
      const redirectedPage = await waitForCurrentPagePath(activeMiniProgram, '/pages/issue-309/index')
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
      const activeMiniProgram = await getSharedMiniProgram(ctx)
      expect(await waitForCurrentPagePath(activeMiniProgram, '/pages/issue-380/index')).toBeTruthy()
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
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-385/index', undefined, 45_000, { readiness: 'route' })
      if (!issuePage) {
        throw new Error('Failed to launch issue-385 page')
      }

      const runtimeResult = await waitForIssue385Runtime(issuePage, 30_000)
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

      const runtimeResult = layoutResult?.runtime ?? await callRoutePageMethod(miniProgram, '/pages/issue-398/index', '_runE2E')
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

      const activeMiniProgram = await getSharedMiniProgram(ctx)
      const initialRuntime = await waitForIssue404HookReady(activeMiniProgram)
      expect(initialRuntime?.hasInstanceOnPageScroll).toBe(true)

      await callRoutePageMethod(activeMiniProgram, '/pages/issue-404/index', '_runE2E', 'scroll')
      await issuePage.waitFor(240)

      const runtimeResult = await waitForIssue404ScrollRuntime(activeMiniProgram)
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

      const activeMiniProgram = await getSharedMiniProgram(ctx)
      const runtimeResult = await waitForIssue418419Runtime(activeMiniProgram)
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

    const miniProgram = await getSharedMiniProgram(ctx)
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
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #479: triggers indirect pull-down hook in DevTools runtime', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-479/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-479/index.js')
    const issuePageJsonPath = path.join(DIST_ROOT, 'pages/issue-479/index.json')

    const miniProgram = await getSharedMiniProgram(ctx)
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('issue-479 indirect page feature hooks')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('enableOnPullDownRefresh: true')
    expect(await fs.readFile(issuePageJsonPath, 'utf-8')).toContain('"enablePullDownRefresh": true')

    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-479/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-479 page')
      }
      const activeMiniProgram = await getSharedMiniProgram(ctx)
      const initialRuntime = await waitForIssue479Ready(activeMiniProgram)
      expect(Array.isArray(initialRuntime?.logs)).toBe(true)

      await callRoutePageMethod(activeMiniProgram, '/pages/issue-479/index', '_runE2E', 'pull')
      await issuePage.waitFor(300)

      const runtimeResult = await waitForIssue479PullRuntime(activeMiniProgram)
      expect(runtimeResult?.hasPull).toBe(true)
      expect(runtimeResult?.logs).toContain('pull')
      expect(runtimeResult?.hasBottom).toBe(false)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #479: triggers indirect reach-bottom hook through Component page method bridge', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-479/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-479/index.js')
    const issuePageJsonPath = path.join(DIST_ROOT, 'pages/issue-479/index.json')

    const miniProgram = await getSharedMiniProgram(ctx)
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('issue-479 indirect page feature hooks')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('enableOnReachBottom: true')
    expect(await fs.readFile(issuePageJsonPath, 'utf-8')).toContain('"onReachBottomDistance": 50')

    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-479/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-479 page')
      }
      const activeMiniProgram = await getSharedMiniProgram(ctx)
      await callRoutePageMethod(activeMiniProgram, '/pages/issue-479/index', '_runE2E', 'bottom')
      await issuePage.waitFor(300)

      const runtimeResult = await waitForIssue479BottomRuntime(activeMiniProgram)
      expect(runtimeResult?.hasBottom).toBe(true)
      expect(runtimeResult?.logs).toContain('bottom')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #695: triggers direct pull-down hook through Component page method bridge', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-695/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-695/index.js')
    const issuePageJsonPath = path.join(DIST_ROOT, 'pages/issue-695/index.json')

    const miniProgram = await getSharedMiniProgram(ctx)
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('issue-695 direct pull-down hook')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('enableOnPullDownRefresh: true')
    expect(await fs.readFile(issuePageJsonPath, 'utf-8')).toContain('"enablePullDownRefresh": true')

    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-695/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-695 page')
      }
      const activeMiniProgram = await getSharedMiniProgram(ctx)
      const initialRuntime = await callRoutePageMethod(activeMiniProgram, '/pages/issue-695/index', '_runE2E')
      expect(initialRuntime?.hasPull).toBe(false)

      await callRoutePageMethod(activeMiniProgram, '/pages/issue-695/index', 'onPullDownRefresh')

      const runtimeResult = await waitForIssue695PullRuntime(activeMiniProgram)
      expect(runtimeResult?.count).toBe(1)
      expect(runtimeResult?.doubled).toBe(2)
      expect(runtimeResult?.logs).toContain('pull:1')
      expect(runtimeResult?.hasPull).toBe(true)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
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

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/block-slot/index', undefined, 45_000, { readiness: 'route' })
      if (!issuePage) {
        throw new Error('Failed to launch block-slot page')
      }

      const activeMiniProgram = await getSharedMiniProgram(ctx)
      const initialRuntime = await callRoutePageMethod(activeMiniProgram, '/pages/block-slot/index', '_runE2E')
      expect(initialRuntime?.ok).toBe(true)
      expect(initialRuntime?.headerLabel).toBe('ready')
      expect(initialRuntime?.bodyLabel).toBe('alpha')

      await callRoutePageMethod(activeMiniProgram, '/pages/block-slot/index', 'toggleLabels')
      await issuePage.waitFor(260)

      const updatedRuntime = await callRoutePageMethod(activeMiniProgram, '/pages/block-slot/index', '_runE2E')
      expect(updatedRuntime?.headerLabel).toBe('updated')
      expect(updatedRuntime?.bodyLabel).toBe('beta')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #494: plain template v-slot content unwraps to child slot attrs or block wrappers in DevTools runtime', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-494/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-494/index.js')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/issue-494/SlotHost/index.wxml')

    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('slot="icon"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('<weapp-slot-wrapper slot="header"><view class="issue494-header-probe"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).not.toContain('<view slot="icon">')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).not.toContain('<block slot="header">')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('toggleLabels')
    expect(await fs.readFile(componentWxmlPath, 'utf-8')).toContain('<slot name="icon" />')

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-494/index', undefined, 45_000, { readiness: 'route' })
      if (!issuePage) {
        throw new Error('Failed to launch issue-494 page')
      }

      const activeMiniProgram = await getSharedMiniProgram(ctx)
      const initialRuntime = await callRoutePageMethod(activeMiniProgram, '/pages/issue-494/index', '_runE2E')
      expect(initialRuntime?.ok).toBe(true)
      expect(initialRuntime?.headerLabel).toBe('ready')
      expect(initialRuntime?.bodyLabel).toBe('alpha')
      expect(initialRuntime?.iconSrc).toBe('https://static.example.com/issue-494/icon.png')

      await callRoutePageMethod(activeMiniProgram, '/pages/issue-494/index', 'toggleLabels')
      await issuePage.waitFor(260)

      const updatedRuntime = await callRoutePageMethod(activeMiniProgram, '/pages/issue-494/index', '_runE2E')
      expect(updatedRuntime?.headerLabel).toBe('updated')
      expect(updatedRuntime?.bodyLabel).toBe('beta')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #500: missing inject default continues later setup code in DevTools runtime', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-500/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-500/index.js')

    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('issue-500 inject missing key continuation')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('issue-500:missing-token')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('_runE2E')

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-500/index', undefined, 45_000, { readiness: 'route' })
      if (!issuePage) {
        throw new Error('Failed to launch issue-500 page')
      }

      const runtime = await callRoutePageMethod(miniProgram, '/pages/issue-500/index', '_runE2E')
      expect(runtime?.ok).toBe(true)
      expect(runtime?.continuationText).toBe('continued')
      expect(runtime?.missingType).toBe('fallback')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('experiment: flex parent keeps projected multi-node slot groups visible in DevTools runtime', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/slot-flex-layout/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/slot-flex-layout/index.js')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/slot-flex-host/index.wxml')

    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('slot flex layout experiment')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('<weapp-slot-wrapper slot="middle"><view class="slot-flex-item slot-flex-item--middle-multi-center-a"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('data-case="single-left"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('data-case="single-middle"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('data-case="single-right"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('data-case="middle-multi-left"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('data-case="middle-multi-center-a"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('data-case="middle-multi-center-b"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('data-case="middle-multi-right"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('data-case="all-multi-left-a"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('data-case="all-multi-left-b"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('data-case="all-multi-middle-a"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('data-case="all-multi-middle-b"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('data-case="all-multi-right-a"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('data-case="all-multi-right-b"')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).not.toContain('<block slot="middle">')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).not.toContain('_runE2E')
    expect(await fs.readFile(componentWxmlPath, 'utf-8')).toContain('<slot name="left" />')

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/slot-flex-layout/index', undefined, 45_000, { readiness: 'route' })
      if (!issuePage) {
        throw new Error('Failed to launch slot-flex-layout page')
      }
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
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

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/slot-tag-form/index', undefined, 45_000, { readiness: 'route' })
      if (!issuePage) {
        throw new Error('Failed to launch slot-tag-form page')
      }

      const activeMiniProgram = await getSharedMiniProgram(ctx)
      const initialRuntime = await callRoutePageMethod(activeMiniProgram, '/pages/slot-tag-form/index', '_runE2E')
      expect(initialRuntime?.ok).toBe(true)
      expect(initialRuntime?.sharedHeaderLabel).toBe('ready')
      expect(initialRuntime?.sharedBodyLabel).toBe('alpha')

      await callRoutePageMethod(activeMiniProgram, '/pages/slot-tag-form/index', 'toggleLabels')
      await issuePage.waitFor(260)

      const updatedRuntime = await callRoutePageMethod(activeMiniProgram, '/pages/slot-tag-form/index', '_runE2E')
      expect(updatedRuntime?.sharedHeaderLabel).toBe('updated')
      expect(updatedRuntime?.sharedBodyLabel).toBe('beta')
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
      const launchPage = await relaunchPage(miniProgram, '/pages/issue-373/launch/index', undefined, 45_000, {
        readiness: async (page) => {
          await page.waitForRendered({
            selector: '#issue373-launch-page',
            dataset: { e2eIssue: '373-launch' },
            timeout: 4_000,
          })
          return true
        },
      })
      if (!launchPage) {
        throw new Error('Failed to launch issue-373 launch page')
      }
      const launchRuntime = await waitForIssue373Runtime(launchPage)
      expect(launchRuntime?.ok).toBe(true)
      expect(launchRuntime?.count).toBe(1)
      expect(launchRuntime?.doubled).toBe(2)

      const activeMiniProgram = await getSharedMiniProgram(ctx)
      await callRoutePageMethod(activeMiniProgram, '/pages/issue-373/launch/index', 'runRelaunch')
      const resultPage = await waitForCurrentPagePath(activeMiniProgram, '/pages/issue-373/result/index', 20_000)
      if (!resultPage) {
        throw new Error('Failed to navigate to issue-373 result page via reLaunch')
      }
      await resultPage.waitForRendered({
        selector: '#issue373-result-page',
        dataset: { e2eIssue: '373-result' },
        timeout: 8_000,
      })
      const initialResult = await callRoutePageMethod(activeMiniProgram, '/pages/issue-373/result/index', '_runE2E')
      expect(initialResult?.count).toBe(1)
      expect(initialResult?.doubled).toBe(2)
      expect(initialResult?.ok).toBe(true)

      await callRoutePageMethod(activeMiniProgram, '/pages/issue-373/result/index', 'increment')
      await resultPage.waitFor(260)
      const runtimeResult = await callRoutePageMethod(activeMiniProgram, '/pages/issue-373/result/index', '_runE2E')
      expect(runtimeResult?.count).toBe(2)
      expect(runtimeResult?.doubled).toBe(4)
      expect(runtimeResult?.ok).toBe(true)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
