import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { describe, expect, it, vi } from 'vitest'
import { createBridgeWrapperProjectConfig, enhanceMiniProgramRelaunch, extractDevtoolsCliLoginState, formatRuntimeStatsLine, isDevtoolsHttpPortError, isLikelyRelaunchRetryableError, isWarmupPageRootTimeoutError, isWarmupRelaunchTimeoutError, resolveAutomatorLaunchMode, resolveBridgeWarmupReadyTimeout, resolveLaunchRetryCount, resolveWarmupCurrentPageReadyTimeout, shouldCloseCurrentPageQueryTimeout, shouldPrebuildAutomatorProject, terminateBridgeCliProcess, validateLaunchProjectAssets } from './automator'
import { isResidualDevProcessCommand } from './dev-process-cleanup'

function waitForSpawn(child: ReturnType<typeof spawn>) {
  return new Promise<number>((resolve, reject) => {
    if (typeof child.pid === 'number' && child.pid > 0) {
      resolve(child.pid)
      return
    }

    child.once('spawn', () => {
      if (typeof child.pid === 'number' && child.pid > 0) {
        resolve(child.pid)
        return
      }
      reject(new Error('Failed to get child pid after spawn'))
    })
    child.once('error', reject)
  })
}

function isMissingProcessError(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === 'ESRCH'
}

async function waitForProcessGone(pid: number, timeoutMs = 3_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      process.kill(pid, 0)
    }
    catch (error) {
      if (isMissingProcessError(error)) {
        return
      }
      throw error
    }
    await new Promise(resolve => setTimeout(resolve, 120))
  }
  throw new Error(`Timed out waiting pid=${pid} to exit after ${timeoutMs}ms`)
}

describe('automator', () => {
  it('waits until every configured page bundle exists before launching DevTools', () => {
    const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'weapp-vite-launch-assets-'))
    const appConfigPath = path.join(outputRoot, 'app.json')
    const config = {
      pages: ['pages/index/index'],
      subPackages: [{ root: 'package-a', pages: ['pages/detail/index'] }],
    }

    try {
      fs.mkdirSync(path.join(outputRoot, 'pages/index'), { recursive: true })
      fs.writeFileSync(path.join(outputRoot, 'pages/index/index.js'), '')

      expect(validateLaunchProjectAssets(appConfigPath, config)).toEqual({
        ready: false,
        reason: 'page bundle is missing: package-a/pages/detail/index.js',
      })

      fs.mkdirSync(path.join(outputRoot, 'package-a/pages/detail'), { recursive: true })
      fs.writeFileSync(path.join(outputRoot, 'package-a/pages/detail/index.js'), '')

      expect(validateLaunchProjectAssets(appConfigPath, config)).toEqual({ ready: true })
    }
    finally {
      fs.rmSync(outputRoot, { recursive: true, force: true })
    }
  })

  it('extracts login state from WeChat DevTools cli output', () => {
    expect(extractDevtoolsCliLoginState('- initialize\n\n{"login":false}\n✔ islogin')).toBe(false)
    expect(extractDevtoolsCliLoginState('- initialize\n\n{"login":true}\n✔ islogin')).toBe(true)
    expect(extractDevtoolsCliLoginState('')).toBeNull()
  })

  it('treats App.getCurrentPage protocol timeout as a retryable relaunch error', () => {
    const error = new Error('DevTools did not respond to protocol method App.getCurrentPage within 30000ms')

    expect(isLikelyRelaunchRetryableError(error)).toBe(true)
  })

  it('treats the generic DevTools reLaunch protocol rejection as retryable', () => {
    const error = new Error('Uncaught [object Object]')

    expect(isLikelyRelaunchRetryableError(error)).toBe(true)
  })

  it('retries a generic DevTools reLaunch rejection before closing the session', async () => {
    const targetPage = {
      path: '/pages/index/index',
    }
    const rawReLaunch = vi.fn()
      .mockRejectedValueOnce(new Error('Uncaught [object Object]'))
      .mockResolvedValueOnce(targetPage)
    const miniProgram = {
      close: vi.fn(),
      currentPage: vi.fn(async () => ({ path: '/pages/other/index' })),
      reLaunch: rawReLaunch,
    }

    enhanceMiniProgramRelaunch(miniProgram, {
      project: 'test-project',
      retryDelayMs: 0,
      skipPageRootCheck: true,
    })

    await expect(miniProgram.reLaunch('/pages/index/index')).resolves.toBe(targetPage)
    expect(rawReLaunch).toHaveBeenCalledTimes(2)
    expect(miniProgram.close).not.toHaveBeenCalled()
  })

  it('treats a closed DevTools connection as a retryable relaunch error', () => {
    const error = new Error('Connection closed, check if wechat web devTools is still running')

    expect(isLikelyRelaunchRetryableError(error)).toBe(true)
  })

  it('treats missing DevTools page metadata as a retryable relaunch error', () => {
    const error = new Error('Cannot destructure property \'rawPath\' of \'t.getPageMetaByWebviewId(...)\' as it is null.')

    expect(isLikelyRelaunchRetryableError(error)).toBe(true)
  })

  it('classifies warmup page root timeouts without forcing full launch retries', () => {
    const error = new Error('Timed out waiting page root after warmup reLaunch: /pages/index/index')

    expect(isLikelyRelaunchRetryableError(error)).toBe(true)
    expect(isWarmupPageRootTimeoutError(error)).toBe(true)
  })

  it('classifies warmup relaunch timeouts without forcing full launch retries', () => {
    const error = new Error('Timeout in warmup reLaunch /pages/home/home after 30000ms')

    expect(isLikelyRelaunchRetryableError(error)).toBe(true)
    expect(isWarmupRelaunchTimeoutError(error)).toBe(true)
  })

  it('treats WeChat DevTools prebuild port timeout as an infra launch error', () => {
    const error = new Error('Wechat DevTools CLI prebuild failed: - initialize ✖ IDE may already started at port 18085, trying to connect ✖ #initialize-error: wait IDE port timeout')

    expect(isDevtoolsHttpPortError(error)).toBe(true)
  })

  it('defaults IDE launches to bridge mode without direct prebuild', () => {
    const previousLaunchMode = process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE
    const previousPrebuild = process.env.WEAPP_VITE_E2E_AUTOMATOR_PREBUILD
    delete process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE
    delete process.env.WEAPP_VITE_E2E_AUTOMATOR_PREBUILD

    try {
      expect(resolveAutomatorLaunchMode()).toBe('bridge')
      expect(shouldPrebuildAutomatorProject()).toBe(false)

      process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = 'direct'
      process.env.WEAPP_VITE_E2E_AUTOMATOR_PREBUILD = '1'

      expect(resolveAutomatorLaunchMode()).toBe('direct')
      expect(shouldPrebuildAutomatorProject()).toBe(true)
    }
    finally {
      if (previousLaunchMode == null) {
        delete process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE
      }
      else {
        process.env.WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE = previousLaunchMode
      }
      if (previousPrebuild == null) {
        delete process.env.WEAPP_VITE_E2E_AUTOMATOR_PREBUILD
      }
      else {
        process.env.WEAPP_VITE_E2E_AUTOMATOR_PREBUILD = previousPrebuild
      }
    }
  })

  it('limits launch retries for suites that must not relaunch DevTools repeatedly', () => {
    expect(resolveLaunchRetryCount(1)).toBe(1)
    expect(resolveLaunchRetryCount(0)).toBe(1)
    expect(resolveLaunchRetryCount(2.8)).toBe(2)
    expect(resolveLaunchRetryCount(Number.POSITIVE_INFINITY)).toBe(resolveLaunchRetryCount(undefined))
    expect(resolveLaunchRetryCount(99)).toBe(resolveLaunchRetryCount(undefined))
  })

  it('gives bridge cold compilation a separate warmup budget', () => {
    expect(resolveBridgeWarmupReadyTimeout(undefined)).toBe(60_000)
    expect(resolveBridgeWarmupReadyTimeout('90000')).toBe(90_000)
    expect(resolveBridgeWarmupReadyTimeout('0')).toBe(60_000)
    expect(resolveWarmupCurrentPageReadyTimeout(false, true, 60_000, 30_000)).toBe(60_000)
    expect(resolveWarmupCurrentPageReadyTimeout(false, false, 60_000, 30_000)).toBe(300)
    expect(resolveWarmupCurrentPageReadyTimeout(true, true, 60_000, 30_000)).toBe(300)
  })

  it('keeps an exhausted polling budget from closing an otherwise responsive warmup session', () => {
    expect(shouldCloseCurrentPageQueryTimeout(true, 1)).toBe(false)
    expect(shouldCloseCurrentPageQueryTimeout(true, 220)).toBe(false)
    expect(shouldCloseCurrentPageQueryTimeout(true, 221)).toBe(true)
    expect(shouldCloseCurrentPageQueryTimeout(false, 2_000)).toBe(false)
  })

  it('matches absolute and repository-relative weapp-vite dev commands for cleanup', () => {
    expect(isResidualDevProcessCommand(
      'node --import tsx /workspace/packages/weapp-vite/bin/weapp-vite.js dev /workspace/e2e-apps/wevu-runtime-e2e --platform weapp',
    )).toBe(true)
    expect(isResidualDevProcessCommand(
      'node --import tsx packages/weapp-vite/src/cli.ts dev apps/demo --platform weapp',
    )).toBe(true)
  })

  it('matches scoped pnpm dev commands without selecting unrelated processes', () => {
    expect(isResidualDevProcessCommand(
      'pnpm --dir /workspace/e2e-apps/demo run dev',
    )).toBe(true)
    expect(isResidualDevProcessCommand(
      'node /workspace/packages/weapp-vite/bin/weapp-vite.js build /workspace/e2e-apps/demo',
    )).toBe(false)
    expect(isResidualDevProcessCommand(
      'pnpm --dir /workspace/website run dev',
    )).toBe(false)
  })

  it('can switch a deferred bridge wrapper to an isolated runtime root', () => {
    const config = createBridgeWrapperProjectConfig({}, {}, {
      miniprogramRoot: '__runtime__/',
    })

    expect(config.miniprogramRoot).toBe('__runtime__/')
    expect(config.srcMiniprogramRoot).toBe('__runtime__/')
    expect(createBridgeWrapperProjectConfig({}, {}, {
      miniprogramRoot: '../outside',
    }).miniprogramRoot).toBe('./')
  })

  it('creates self-contained bridge wrapper project config', () => {
    const config = createBridgeWrapperProjectConfig({
      appid: 'wxb3d842a4a7e3440d',
      miniprogramRoot: 'dist/',
      simulatorType: 'wechat',
      srcMiniprogramRoot: 'dist/',
      pluginRoot: 'plugin/',
      compileType: 'miniprogram',
      setting: {
        es6: true,
        packNpmRelationList: [
          {
            packageJsonPath: './package.json',
            miniprogramNpmDistDir: './dist',
          },
        ],
      },
      condition: {
        miniprogram: {
          list: [],
        },
      },
    }, {
      libVersion: '3.15.0',
      miniprogramRoot: 'private-dist/',
      setting: {
        compileHotReLoad: true,
        packNpmRelationList: [],
        urlCheck: false,
      },
    })

    expect(config).toMatchObject({
      appid: 'wxb3d842a4a7e3440d',
      compileType: 'miniprogram',
      libVersion: '3.15.0',
      miniprogramRoot: './',
      srcMiniprogramRoot: './',
      pluginRoot: 'plugin/',
      setting: {
        compileHotReLoad: true,
        es6: true,
        packNpmRelationList: [],
        urlCheck: false,
      },
      condition: {
        miniprogram: {
          list: [],
        },
      },
    })
    expect(config).toHaveProperty('simulatorType', 'wechat')
  })

  it('removes simulator selection while preserving compiler settings in precompiled bridge wrapper config', () => {
    const config = createBridgeWrapperProjectConfig({
      appid: 'wxb3d842a4a7e3440d',
      miniprogramRoot: 'dist/',
      simulatorPluginLibVersion: {},
      simulatorType: 'wechat',
      setting: {
        es6: true,
        postcss: true,
        urlCheck: false,
      },
    }, {}, {
      precompiled: true,
    })

    expect(config).not.toHaveProperty('simulatorType')
    expect(config).not.toHaveProperty('simulatorPluginLibVersion')
    expect(config.setting).toEqual({
      es6: true,
      packNpmManually: false,
      packNpmRelationList: [],
      postcss: true,
      urlCheck: false,
    })
  })

  it('uses the complete stable compiler settings in bootstrap bridge wrapper config', () => {
    const config = createBridgeWrapperProjectConfig({
      appid: 'wxb3d842a4a7e3440d',
      simulatorPluginLibVersion: {},
      simulatorType: 'wechat',
      setting: {
        es6: true,
        postcss: true,
        urlCheck: false,
      },
    }, {}, {
      bootstrap: true,
    })

    expect(config).toMatchObject({
      simulatorType: 'wechat',
      simulatorPluginLibVersion: {},
    })
    expect(config.setting).toEqual({
      es6: true,
      packNpmManually: false,
      packNpmRelationList: [],
      postcss: true,
      urlCheck: false,
    })
  })

  it('keeps legacy runtime issue totals while exposing ordinary log counts', () => {
    expect(formatRuntimeStatsLine({
      debug: 1,
      info: 2,
      log: 3,
      warn: 4,
      error: 5,
      exception: 6,
      total: 21,
    })).toBe('[e2e-runtime-stats] warn=4 error=5 exception=6 total=15 log=3 info=2 debug=1 all=21')
  })

  it('terminates detached bridge cli processes', async () => {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 10_000)'], {
      detached: process.platform !== 'win32',
      stdio: 'ignore',
    })
    child.unref()

    const pid = await waitForSpawn(child)
    await terminateBridgeCliProcess(pid)

    await expect(waitForProcessGone(pid)).resolves.toBeUndefined()
  })
})
