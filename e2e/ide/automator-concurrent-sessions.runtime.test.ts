import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll } from 'vitest'
import { isDevtoolsHttpPortError, isDevtoolsSimulatorBootError, launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const AUTOMATOR_LAUNCH_MODE_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE'
const AUTOMATOR_LAUNCH_MODE_BRIDGE = 'bridge'
const AUTOMATOR_PREBUILD_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_PREBUILD'
const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const BASE_APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/base')
const NATIVE_APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-lifecycle-native')
const INDEX_ROUTE = '/pages/index/index'
const LEADING_SLASH_RE = /^\/+/
const HOOK_TIMEOUT = 180_000
const LAUNCH_TIMEOUT = 60_000

interface AutomatorSessionMetadata {
  port: number
  projectPath: string
  wsEndpoint: string
}

function normalizeRoutePath(routePath: string) {
  return routePath.replace(LEADING_SLASH_RE, '')
}

function readSessionMetadata(miniProgram: any) {
  return Reflect.get(miniProgram as object, '__WEAPP_VITE_SESSION_METADATA') as AutomatorSessionMetadata | undefined
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isConcurrentSessionInfraError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return isDevtoolsHttpPortError(error)
    || isDevtoolsSimulatorBootError(error)
    || /Timeout in launch concurrent automator/i.test(message)
}

async function waitForCurrentPage(miniProgram: any, expectedPath: string, timeoutMs = 20_000) {
  const normalizedExpectedPath = normalizeRoutePath(expectedPath)
  const start = Date.now()

  while (Date.now() - start <= timeoutMs) {
    try {
      const page = await miniProgram.currentPage()
      if (normalizeRoutePath(String(page?.path ?? '')) === normalizedExpectedPath) {
        return page
      }
    }
    catch (error) {
      if (isConcurrentSessionInfraError(error)) {
        throw error
      }
    }
    await delay(250)
  }

  return null
}

async function resolveRoutePage(miniProgram: any, expectedPath: string) {
  const currentPage = await waitForCurrentPage(miniProgram, expectedPath, 8_000)
  if (currentPage) {
    return currentPage
  }

  try {
    const page = await miniProgram.reLaunch(expectedPath)
    if (normalizeRoutePath(String(page?.path ?? '')) === normalizeRoutePath(expectedPath)) {
      return page
    }
  }
  catch (error) {
    if (isConcurrentSessionInfraError(error)) {
      throw error
    }
  }
  return await waitForCurrentPage(miniProgram, expectedPath)
}

async function readPageWxml(page: any) {
  const element = await page.$('page')
  if (!element) {
    throw new Error('Failed to find page element')
  }
  return await element.wxml()
}

async function runBuild(projectRoot: string, label: string) {
  await fs.remove(path.join(projectRoot, 'dist'))
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot,
    platform: 'weapp',
    skipNpm: true,
    label,
  })
}

async function launchProjectAutomator(projectPath: string) {
  return await launchAutomator({
    projectPath,
    skipWarmup: true,
    timeout: LAUNCH_TIMEOUT,
  })
}

async function closeMiniProgram(miniProgram: any) {
  if (!miniProgram) {
    return
  }
  await miniProgram.close().catch(() => {})
}

function createTimeoutError(label: string, timeoutMs: number) {
  return new Error(`Timeout in ${label} after ${timeoutMs}ms`)
}

async function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(createTimeoutError(label, timeoutMs)), timeoutMs)
      }),
    ])
  }
  finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

function createConcurrentSessionInfraUnavailableMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return `WeChat DevTools automator 基础设施不可用，跳过 concurrent sessions IDE 自动化用例。reason=${message}`
}

describe.sequential('automator concurrent sessions', () => {
  const miniPrograms: any[] = []
  let previousLaunchMode: string | undefined
  let previousPrebuild: string | undefined
  let infraUnavailableMessage = ''

  beforeAll(async () => {
    previousLaunchMode = process.env[AUTOMATOR_LAUNCH_MODE_ENV]
    previousPrebuild = process.env[AUTOMATOR_PREBUILD_ENV]
    process.env[AUTOMATOR_LAUNCH_MODE_ENV] = AUTOMATOR_LAUNCH_MODE_BRIDGE
    // 这个用例验证同一进程内保留多个 automator 会话；prebuild 会经过
    // DevTools 全局项目索引通道，可能把前一个活跃会话切到恢复路径。
    process.env[AUTOMATOR_PREBUILD_ENV] = '0'
    await Promise.all([
      runBuild(BASE_APP_ROOT, 'ide:automator-concurrent-sessions:base'),
      runBuild(NATIVE_APP_ROOT, 'ide:automator-concurrent-sessions:native'),
    ])
    // DevTools cache recovery 是进程全局清理；串行启动避免一个项目的恢复流程关闭另一个新会话。
    try {
      const sessions = [
        await withTimeout(
          launchProjectAutomator(BASE_APP_ROOT),
          'launch concurrent automator base',
          LAUNCH_TIMEOUT,
        ),
        await withTimeout(
          launchProjectAutomator(NATIVE_APP_ROOT),
          'launch concurrent automator native',
          LAUNCH_TIMEOUT,
        ),
      ]
      miniPrograms.push(...sessions)
    }
    catch (error) {
      if (isConcurrentSessionInfraError(error)) {
        infraUnavailableMessage = createConcurrentSessionInfraUnavailableMessage(error)
        return
      }
      throw error
    }
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (previousLaunchMode === undefined) {
      delete process.env[AUTOMATOR_LAUNCH_MODE_ENV]
    }
    else {
      process.env[AUTOMATOR_LAUNCH_MODE_ENV] = previousLaunchMode
    }
    if (previousPrebuild === undefined) {
      delete process.env[AUTOMATOR_PREBUILD_ENV]
    }
    else {
      process.env[AUTOMATOR_PREBUILD_ENV] = previousPrebuild
    }

    await Promise.all(miniPrograms.map(closeMiniProgram))
  }, HOOK_TIMEOUT)

  it('launches one independent automator connection per project', async (ctx) => {
    if (infraUnavailableMessage) {
      ctx.skip(infraUnavailableMessage)
      return
    }

    const [baseMiniProgram, nativeMiniProgram] = miniPrograms

    const baseMetadata = readSessionMetadata(baseMiniProgram)
    const nativeMetadata = readSessionMetadata(nativeMiniProgram)

    expect(baseMetadata?.projectPath).toContain(path.join('.tmp', 'e2e-ide-bridge-projects'))
    expect(nativeMetadata?.projectPath).toContain(path.join('.tmp', 'e2e-ide-bridge-projects'))
    expect(baseMetadata?.projectPath).not.toBe(nativeMetadata?.projectPath)
    expect(baseMetadata?.wsEndpoint).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/)
    expect(nativeMetadata?.wsEndpoint).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/)
    expect(baseMetadata?.port).not.toBe(nativeMetadata?.port)
    expect(baseMetadata?.wsEndpoint).not.toBe(nativeMetadata?.wsEndpoint)

    let basePage: any = null
    let nativePage: any = null
    try {
      ;[basePage, nativePage] = await Promise.all([
        resolveRoutePage(baseMiniProgram, INDEX_ROUTE),
        resolveRoutePage(nativeMiniProgram, INDEX_ROUTE),
      ])
    }
    catch (error) {
      if (isConcurrentSessionInfraError(error)) {
        ctx.skip(createConcurrentSessionInfraUnavailableMessage(error))
        return
      }
      throw error
    }

    expect(basePage).toBeTruthy()
    expect(nativePage).toBeTruthy()
    if (!basePage || !nativePage) {
      throw new Error('Failed to resolve concurrent session pages')
    }

    const [baseWxml, nativeWxml] = await Promise.all([
      readPageWxml(basePage),
      readPageWxml(nativePage),
    ])

    expect(baseWxml).toContain('Status: ready')
    expect(baseWxml).toContain('Target: index snapshot')
    expect(nativeWxml).toContain('App lifecycle native')
    expect(nativeWxml).toContain('E2E Result')
  })
})
