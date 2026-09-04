import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'

const AUTOMATOR_LAUNCH_MODE_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE'
const AUTOMATOR_LAUNCH_MODE_BRIDGE = 'bridge'
const AUTOMATOR_PREBUILD_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_PREBUILD'
const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const BASE_APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/base')
const NATIVE_APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-lifecycle-native')
const INDEX_ROUTE = '/pages/index/index'
const LEADING_SLASH_RE = /^\/+/
const HOOK_TIMEOUT = 300_000
const LAUNCH_TIMEOUT = 60_000
const RUNTIME_SNAPSHOT_ATTEMPT_TIMEOUT = 5_000
const RUNTIME_SNAPSHOT_TIMEOUT = 45_000

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

function isRuntimeSnapshotReady(snapshot: any, sessionLabel: string) {
  if (normalizeRoutePath(String(snapshot?.route ?? '')) !== normalizeRoutePath(INDEX_ROUTE)) {
    return false
  }
  if (sessionLabel === 'base') {
    return snapshot?.pageData?.__e2eResult?.status === 'ready'
  }
  return snapshot?.pageData?.message === 'App lifecycle native'
    && Array.isArray(snapshot?.appData?.__lifecycleLogs)
}

async function readRuntimeSnapshot(miniProgram: any, sessionLabel: string) {
  const startedAt = Date.now()
  let lastError: unknown
  let latestSnapshot: any
  while (Date.now() - startedAt <= RUNTIME_SNAPSHOT_TIMEOUT) {
    try {
      latestSnapshot = await miniProgram.evaluateWithOptions(() => {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
        const currentPage = pages[pages.length - 1]
        const app = getApp()
        return {
          route: currentPage?.route || currentPage?.path || currentPage?.__route__ || '',
          pageData: currentPage?.data ?? {},
          appData: app?.globalData ?? {},
        }
      }, {
        timeout: RUNTIME_SNAPSHOT_ATTEMPT_TIMEOUT,
      })
      if (isRuntimeSnapshotReady(latestSnapshot, sessionLabel)) {
        return latestSnapshot
      }
    }
    catch (error) {
      lastError = error
    }
    await delay(300)
  }
  const reason = lastError instanceof Error
    ? lastError
    : new Error(`Latest snapshot: ${JSON.stringify(latestSnapshot)}`)
  throw new Error(`Failed to read concurrent ${sessionLabel} runtime snapshot`, {
    cause: reason,
  })
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

describe('automator concurrent sessions', { concurrent: false }, () => {
  const miniPrograms: any[] = []
  let baseSnapshot: any
  let baseToolInfo: any
  let previousLaunchMode: string | undefined
  let previousPrebuild: string | undefined

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
    const baseMiniProgram = await launchProjectAutomator(BASE_APP_ROOT)
    miniPrograms.push(baseMiniProgram)
    baseSnapshot = await readRuntimeSnapshot(baseMiniProgram, 'base')
    baseToolInfo = await baseMiniProgram.toolInfo()

    const nativeMiniProgram = await launchProjectAutomator(NATIVE_APP_ROOT)
    miniPrograms.push(nativeMiniProgram)
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
    await cleanupResidualIdeProcesses()
  }, HOOK_TIMEOUT)

  it('assigns independent automator session metadata to each project', async () => {
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

    // DevTools 同一 AppID 只保证当前前台项目的 AppService 协议可响应，因此
    // 页面快照在启动第二个项目前读取，并用两个 Tool 域探针锁定并发连接契约。
    expect(normalizeRoutePath(String(baseSnapshot?.route ?? ''))).toBe(normalizeRoutePath(INDEX_ROUTE))
    expect(baseSnapshot?.pageData?.__e2eResult?.status).toBe('ready')
    expect(baseSnapshot?.pageData?.__e2eData?.target).toBe('index snapshot')
    expect(baseToolInfo?.SDKVersion).toEqual(expect.any(String))
  })
})
