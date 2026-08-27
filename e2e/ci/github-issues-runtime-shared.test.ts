import os from 'node:os'
import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { describe, expect, it, vi } from 'vitest'
import {
  callRoutePageMethod,
  createGithubIssuesLaunchAutomatorOptions,
  isRenderedProtocolSessionError,
  pruneGithubIssuesBuildInputs,
  relaunchPage,
  resolveGithubIssuesScopedTargetFile,
  resolveSharedMiniProgramRestartRoute,
  shouldDeferSharedMiniProgramClose,
} from '../ide/github-issues.runtime.shared'

describe('github issues runtime shared relaunch helper', () => {
  it('delegates transient DevTools launch recovery to the shared automator launcher', () => {
    expect(createGithubIssuesLaunchAutomatorOptions('project-root')).toEqual({
      deferBridgeWrapperSyncUntilConnected: true,
      projectPath: 'project-root',
      retryWarmupTimeout: true,
      skipRelaunchPageRootCheck: true,
      warmupAllowRelaunch: true,
    })
  })

  it('pins the WeChat simulator type before DevTools creates the project builder', async () => {
    const projectConfig = await fs.readJSON(path.resolve(
      import.meta.dirname,
      '../../e2e-apps/github-issues/project.config.json',
    )) as Record<string, unknown>

    expect(projectConfig.simulatorType).toBe('wechat')
  })

  it('removes build-only inputs before DevTools indexes the isolated project', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-github-issues-'))
    try {
      await Promise.all([
        fs.ensureDir(path.join(projectRoot, '.weapp-vite/cache')),
        fs.ensureDir(path.join(projectRoot, 'dist/pages/index')),
        fs.ensureDir(path.join(projectRoot, 'node_modules/package')),
        fs.ensureDir(path.join(projectRoot, 'src/pages/index')),
        fs.writeJSON(path.join(projectRoot, 'project.config.json'), {
          miniprogramRoot: 'dist/',
        }),
      ])

      await pruneGithubIssuesBuildInputs(projectRoot)

      await expect(fs.pathExists(path.join(projectRoot, '.weapp-vite'))).resolves.toBe(false)
      await expect(fs.pathExists(path.join(projectRoot, 'node_modules'))).resolves.toBe(false)
      await expect(fs.pathExists(path.join(projectRoot, 'src'))).resolves.toBe(false)
      await expect(fs.pathExists(path.join(projectRoot, 'dist/pages/index'))).resolves.toBe(true)
      await expect(fs.pathExists(path.join(projectRoot, 'project.config.json'))).resolves.toBe(true)
    }
    finally {
      await fs.remove(projectRoot)
    }
  })

  it('scopes every github-issues runtime build to its current test target', () => {
    expect(resolveGithubIssuesScopedTargetFile(
      'ide/github-issues.runtime.issue448-formdata-upload.test.ts',
    )).toBe('ide/github-issues.runtime.issue448-formdata-upload.test.ts')
    expect(resolveGithubIssuesScopedTargetFile(
      'ide/github-issues.runtime.aggregate.compiler.test.ts',
    )).toBe('ide/github-issues.runtime.aggregate.compiler.test.ts')
    expect(resolveGithubIssuesScopedTargetFile('ide/app-lifecycle.test.ts')).toBeUndefined()
    expect(resolveGithubIssuesScopedTargetFile('')).toBeUndefined()
  })

  it('defers aggregate suite cleanup while preserving explicit runtime restarts', () => {
    const aggregateTarget = 'ide/github-issues.runtime.aggregate.test.ts'

    expect(shouldDeferSharedMiniProgramClose({}, aggregateTarget)).toBe(true)
    expect(shouldDeferSharedMiniProgramClose({ force: true }, aggregateTarget)).toBe(false)
    expect(shouldDeferSharedMiniProgramClose({}, 'ide/github-issues.runtime.props.test.ts')).toBe(false)
  })

  it('keeps aggregate runtime restarts on the stable launch route', () => {
    const aggregateTarget = 'ide/github-issues.runtime.aggregate.test.ts'

    expect(resolveSharedMiniProgramRestartRoute('/pages/issue-642/index', aggregateTarget)).toBe('/pages/issue-431/index')
    expect(resolveSharedMiniProgramRestartRoute('/pages/issue-642/index', 'ide/github-issues.runtime.issue642.test.ts')).toBe('/pages/issue-642/index')
  })

  it('classifies only rendered App.callFunction protocol timeouts as recoverable', () => {
    expect(isRenderedProtocolSessionError(new Error(
      'Timed out waiting page rendered; reason=DevTools did not respond to protocol method App.callFunction within 711ms',
    ))).toBe(true)
    expect(isRenderedProtocolSessionError(new Error('DEVTOOLS_PROTOCOL_TIMEOUT App.callFunction'))).toBe(true)
    expect(isRenderedProtocolSessionError(new Error('App.callFunction failed with DEVTOOLS_PROTOCOL_TIMEOUT'))).toBe(true)
    expect(isRenderedProtocolSessionError(new Error('Failed to resolve current rendered page'))).toBe(false)
    expect(isRenderedProtocolSessionError(new Error('DEVTOOLS_PROTOCOL_TIMEOUT Page.callMethod'))).toBe(false)
    expect(isRenderedProtocolSessionError(new Error('DevTools did not respond to protocol method Page.callMethod'))).toBe(false)
  })

  it('relaunches when the current page is not the target route', async () => {
    const targetPage = {
      path: '/pages/index/index',
      waitFor: vi.fn(async () => {}),
      waitForRendered: vi.fn(async () => '<view id="issue-index-ready" />'),
    }
    const miniProgram = {
      currentPage: vi.fn()
        .mockResolvedValueOnce({
          path: '/pages/other/index',
          waitFor: vi.fn(async () => {}),
        })
        .mockResolvedValue(targetPage),
      reLaunch: vi.fn(async () => targetPage),
      evaluate: vi.fn(async () => '/pages/index/index'),
    }

    const page = await relaunchPage(miniProgram, '/pages/index/index', undefined, 1, {
      readiness: 'route',
    })

    expect(page).toBe(targetPage)
    expect(miniProgram.reLaunch).toHaveBeenCalledWith('/pages/index/index')
  })

  it('force relaunches the same route to clear current query parameters', async () => {
    const targetPage = {
      path: '/pages/issue-600/index',
      query: {},
    }
    const miniProgram = {
      currentPage: vi.fn(async () => targetPage),
      reLaunch: vi.fn(async () => targetPage),
      evaluate: vi.fn(async () => '/pages/issue-600/index'),
    }

    const page = await relaunchPage(miniProgram, '/pages/issue-600/index', undefined, 1, {
      forceRelaunch: true,
      readiness: 'route',
    })

    expect(page).toBe(targetPage)
    expect(miniProgram.reLaunch).toHaveBeenCalledTimes(1)
    expect(miniProgram.reLaunch).toHaveBeenCalledWith('/pages/issue-600/index')
  })

  it('retries rendered root selectors during the readiness window', async () => {
    let rootAttempts = 0
    const targetPage = {
      path: '/pages/issue-554/index',
      waitForRendered: vi.fn(async ({ selector }: { selector: string }) => {
        if (selector === '#issue554-page') {
          rootAttempts += 1
          if (rootAttempts >= 2) {
            return '<view id="issue554-page" />'
          }
        }
        throw new Error(`not rendered: ${selector}`)
      }),
    }
    const miniProgram = {
      currentPage: vi.fn(async () => targetPage),
      evaluate: vi.fn(async () => '/pages/issue-554/index'),
    }

    const page = await relaunchPage(miniProgram, '/pages/issue-554/index', undefined, 50, {
      readinessTimeoutMs: 50,
    })

    expect(page).toBe(targetPage)
    expect(rootAttempts).toBe(2)
  })

  it('preserves the rendered root readiness window after app-service route startup', async () => {
    const targetPage = {
      path: '/pages/issue-564/index',
      waitForRendered: vi.fn(async ({ timeout }: { timeout: number }) => {
        expect(timeout).toBeGreaterThanOrEqual(40)
        return '<view class="issue-564-page" />'
      }),
    }
    const miniProgram = {
      currentPage: vi.fn(async () => targetPage),
      evaluate: vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 20))
        return '/pages/issue-564/index'
      }),
    }

    const page = await relaunchPage(miniProgram, '/pages/issue-564/index', undefined, 50, {
      readinessTimeoutMs: 50,
    })

    expect(page).toBe(targetPage)
    expect(targetPage.waitForRendered).toHaveBeenCalledTimes(1)
  })

  it('treats explicit route readiness as app-service readiness without waiting for rendered DOM', async () => {
    const targetPage = {
      path: '/pages/issue-564/index',
      waitForRendered: vi.fn(async () => '<view class="issue-564-page" />'),
    }
    const miniProgram = {
      currentPage: vi.fn(async () => targetPage),
      evaluate: vi.fn(async () => '/pages/issue-564/index'),
    }

    const page = await relaunchPage(miniProgram, '/pages/issue-564/index', undefined, 50, {
      readiness: 'route',
      readinessTimeoutMs: 50,
    })

    expect(page).toBe(targetPage)
    expect(targetPage.waitForRendered).not.toHaveBeenCalled()
  })

  it('passes the active automator session to custom readiness checks', async () => {
    const targetPage = {
      path: '/pages/issue-627-native/index',
    }
    const miniProgram = {
      currentPage: vi.fn(async () => targetPage),
      evaluate: vi.fn(async () => '/pages/issue-627-native/index'),
    }
    const readiness = vi.fn(async (_page: any, activeMiniProgram: any) => activeMiniProgram === miniProgram)

    const page = await relaunchPage(miniProgram, '/pages/issue-627-native/index', undefined, 50, {
      readiness,
      readinessTimeoutMs: 50,
    })

    expect(page).toBe(targetPage)
    expect(readiness).toHaveBeenCalledWith(targetPage, miniProgram)
  })

  it('stops relaunch retries when DevTools reports a simulator boot failure', async () => {
    const miniProgram = {
      currentPage: vi.fn(async () => ({
        path: '/pages/other/index',
      })),
      reLaunch: vi.fn(async () => {
        throw new Error('WeChat DevTools simulator boot error detected in IDE log')
      }),
    }

    await expect(relaunchPage(miniProgram, '/pages/index/index', undefined, 1, {
      readiness: 'route',
    })).resolves.toBeNull()

    expect(miniProgram.reLaunch).toHaveBeenCalledTimes(1)
  })

  it('calls route page methods through the route-only page protocol with a scoped timeout', async () => {
    const targetPage = {
      path: '/pages/index/index',
      query: { x: '1' },
      callMethodWithOptions: vi.fn(async (_methodName: string, _options: unknown, value: string) => ({
        ok: true,
        value,
      })),
    }
    const miniProgram = {
      currentPage: vi.fn(async () => targetPage),
    }

    await expect(callRoutePageMethod(miniProgram, '/pages/index/index?x=1#hash', '_runE2E', 'arg')).resolves.toEqual({
      ok: true,
      value: 'arg',
    })

    expect(targetPage.callMethodWithOptions).toHaveBeenCalledWith(
      '_runE2E',
      {
        routeOnly: true,
        timeout: 8_000,
      },
      'arg',
    )
    expect(miniProgram.currentPage).toHaveBeenCalledWith(
      {
        appFunctionFallback: false,
      },
    )
  })
})
