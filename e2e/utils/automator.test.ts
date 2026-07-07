import { spawn } from 'node:child_process'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { createBridgeWrapperProjectConfig, extractDevtoolsCliLoginState, formatRuntimeStatsLine, isDevtoolsHttpPortError, isLikelyRelaunchRetryableError, resolveAutomatorLaunchMode, shouldPrebuildAutomatorProject, terminateBridgeCliProcess } from './automator'

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
  it('extracts login state from WeChat DevTools cli output', () => {
    expect(extractDevtoolsCliLoginState('- initialize\n\n{"login":false}\n✔ islogin')).toBe(false)
    expect(extractDevtoolsCliLoginState('- initialize\n\n{"login":true}\n✔ islogin')).toBe(true)
    expect(extractDevtoolsCliLoginState('')).toBeNull()
  })

  it('treats App.getCurrentPage protocol timeout as a retryable relaunch error', () => {
    const error = new Error('DevTools did not respond to protocol method App.getCurrentPage within 30000ms')

    expect(isLikelyRelaunchRetryableError(error)).toBe(true)
  })

  it('treats missing DevTools page metadata as a retryable relaunch error', () => {
    const error = new Error('Cannot destructure property \'rawPath\' of \'t.getPageMetaByWebviewId(...)\' as it is null.')

    expect(isLikelyRelaunchRetryableError(error)).toBe(true)
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

  it('creates self-contained bridge wrapper project config', () => {
    const config = createBridgeWrapperProjectConfig({
      appid: 'wxb3d842a4a7e3440d',
      miniprogramRoot: 'dist/',
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
      setting: {
        packNpmRelationList: [],
      },
    })

    expect(config).toMatchObject({
      appid: 'wxb3d842a4a7e3440d',
      compileType: 'miniprogram',
      miniprogramRoot: './',
      srcMiniprogramRoot: './',
      pluginRoot: 'plugin/',
      setting: {
        es6: true,
        packNpmRelationList: [],
      },
      condition: {
        miniprogram: {
          list: [],
        },
      },
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
