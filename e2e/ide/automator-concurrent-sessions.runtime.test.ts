import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const AUTOMATOR_LAUNCH_MODE_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE'
const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const BASE_APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/base')
const NATIVE_APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-lifecycle-native')
const INDEX_ROUTE = '/pages/index/index'
const LEADING_SLASH_RE = /^\/+/
const HOOK_TIMEOUT = 180_000

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
    catch {
    }
    await delay(250)
  }

  return null
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
    timeout: 120_000,
  })
}

async function closeMiniProgram(miniProgram: any) {
  if (!miniProgram) {
    return
  }
  await miniProgram.close().catch(() => {})
}

describe.sequential('automator concurrent sessions', () => {
  const miniPrograms: any[] = []
  let previousLaunchMode: string | undefined

  beforeAll(async () => {
    previousLaunchMode = process.env[AUTOMATOR_LAUNCH_MODE_ENV]
    process.env[AUTOMATOR_LAUNCH_MODE_ENV] = 'direct'
    await Promise.all([
      runBuild(BASE_APP_ROOT, 'ide:automator-concurrent-sessions:base'),
      runBuild(NATIVE_APP_ROOT, 'ide:automator-concurrent-sessions:native'),
    ])
    const sessions = await Promise.all([
      launchProjectAutomator(BASE_APP_ROOT),
      launchProjectAutomator(NATIVE_APP_ROOT),
    ])
    miniPrograms.push(...sessions)
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (previousLaunchMode === undefined) {
      delete process.env[AUTOMATOR_LAUNCH_MODE_ENV]
    }
    else {
      process.env[AUTOMATOR_LAUNCH_MODE_ENV] = previousLaunchMode
    }

    await Promise.all(miniPrograms.map(closeMiniProgram))
  }, HOOK_TIMEOUT)

  it('launches one independent automator connection per project', async () => {
    const [baseMiniProgram, nativeMiniProgram] = miniPrograms

    const baseMetadata = readSessionMetadata(baseMiniProgram)
    const nativeMetadata = readSessionMetadata(nativeMiniProgram)

    expect(baseMetadata?.projectPath).toBe(BASE_APP_ROOT)
    expect(nativeMetadata?.projectPath).toBe(NATIVE_APP_ROOT)
    expect(baseMetadata?.wsEndpoint).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/)
    expect(nativeMetadata?.wsEndpoint).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/)
    expect(baseMetadata?.port).not.toBe(nativeMetadata?.port)
    expect(baseMetadata?.wsEndpoint).not.toBe(nativeMetadata?.wsEndpoint)

    const [basePage, nativePage] = await Promise.all([
      waitForCurrentPage(baseMiniProgram, INDEX_ROUTE),
      waitForCurrentPage(nativeMiniProgram, INDEX_ROUTE),
    ])

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
