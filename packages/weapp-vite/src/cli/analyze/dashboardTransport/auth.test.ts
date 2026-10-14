import type { DevframeInstance } from 'devframe/initiate'
import type { InlineConfig, Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { Server } from 'node:http'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { startAnalyzeDashboard } from '../dashboard'

const fixture = vi.hoisted(() => ({ root: '', packageJsonPath: '' }))

vi.mock('../../../dashboard/assets', () => ({
  ANALYZE_DASHBOARD_PACKAGE_NAME: '@weapp-vite/dashboard',
  resolveDashboardInstallation: () => ({ root: fixture.root, packageJsonPath: fixture.packageJsonPath }),
}))
vi.mock('../../../dashboard', () => ({
  createAnalyzeDashboardDevframe: () => ({ definition: { id: 'weapp-vite' }, update: vi.fn(), emitRuntimeEvents: vi.fn(), dispose: vi.fn() }),
}))
vi.mock('../../../devLifecycle/shutdown', () => ({ getDevShutdownScope: () => undefined }))
vi.mock('../dashboardMcp', () => ({
  createDashboardMcp: async () => ({ register: vi.fn(), close: vi.fn(), nodeMiddleware: vi.fn(), discoveryMiddleware: vi.fn() }),
}))
vi.mock('../../../devLifecycle/vite', () => ({
  async createDevViteServer(options: InlineConfig) {
    const config = {} as ResolvedConfig
    const plugins = options.plugins as Plugin[]
    // 执行真实 bridge 的配置和启动 hook，但不监听 socket 或启动 Vite watcher。
    const server = {
      config,
      httpServer: new Server(),
      middlewares: { use: vi.fn() },
      resolvedUrls: { local: ['http://dashboard.test/__weapp-vite/'] },
      async listen() {
        for (const plugin of plugins) {
          const start = plugin.buildStart as (() => Promise<void>) | undefined
          await start?.call({ environment: { getTopLevelConfig: () => config } })
        }
      },
      close: vi.fn(async () => {}),
    } as unknown as ViteDevServer
    for (const plugin of plugins) {
      const configure = plugin.configureServer as ((server: ViteDevServer) => void) | undefined
      configure?.(server)
    }
    return server
  },
}))

let root: string
beforeEach(async () => {
  root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'dashboard-auth-owner-')))
  fixture.root = path.join(root, 'dashboard owner')
  await mkdir(fixture.root, { recursive: true })
  fixture.packageJsonPath = path.join(fixture.root, 'package.json')
  await writeFile(fixture.packageJsonPath, JSON.stringify({ name: '@weapp-vite/dashboard', type: 'module' }))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function createPackage(folder: string, name: string, files: Record<string, string>, exports: Record<string, string>) {
  const packageRoot = path.join(folder, 'node_modules', name)
  await mkdir(packageRoot, { recursive: true })
  await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name, type: 'module', exports }))
  for (const [name, code] of Object.entries(files)) {
    await writeFile(path.join(packageRoot, name), code)
  }
  return packageRoot
}

async function linkPackage(name: string, packageRoot: string) {
  const link = path.join(fixture.root, 'node_modules', name)
  await mkdir(path.dirname(link), { recursive: true })
  await symlink(packageRoot, link, process.platform === 'win32' ? 'junction' : 'dir')
}

it.each([
  { layout: 'nested', uiHost: 'hub' },
  { layout: 'virtual-peer', uiHost: 'hub' },
  { layout: 'nested', uiHost: 'standalone' },
  { layout: 'virtual-peer', uiHost: 'standalone' },
] as const)('generates the returned $uiHost magic link from its selected $layout owner auth state', async ({ layout, uiHost }) => {
  const dependencyRoot = layout === 'nested' ? fixture.root : path.join(root, 'virtual store', 'hub-peer-context')
  const devframeRoot = await createPackage(dependencyRoot, 'devframe', {
    'state.mjs': 'export const state = { code: "owner-initial", generation: 0 }',
    'auth.mjs': `import { state } from './state.mjs'
export function refreshTempAuthCode() { return state.code = 'owner-' + ++state.generation }
export function getTempAuthCode() { return state.code }
export function matches(code) { return code === state.code }
export function buildOtpAuthUrl(url, code) { return url + '#devframe_otp=' + code }
`,
    'initiate.mjs': `import { matches } from './auth.mjs'
let host
export function initDevframe() { return host = { ready: Promise.resolve(), close: async () => {}, register() {}, nodeMiddleware() {}, authenticate: matches } }
export function getLastHost() { return host }
`,
  }, { './node/auth': './auth.mjs', './initiate': './initiate.mjs' })
  const hubRoot = await createPackage(dependencyRoot, '@devframes/hub', {
    'initiate.mjs': `import { matches } from 'devframe/node/auth'
let host
export function initHub() { return host = { ready: Promise.resolve(), close: async () => {}, register() {}, nodeMiddleware() {}, authenticate: matches } }
export function getLastHost() { return host }
`,
  }, { './initiate': './initiate.mjs' })
  const uiRoot = await createPackage(dependencyRoot, '@devframes/hub-ui', { 'index.mjs': 'export function createUi() { return {} }' }, { '.': './index.mjs' })
  if (layout === 'virtual-peer') {
    await linkPackage('devframe', devframeRoot)
    await linkPackage('@devframes/hub', hubRoot)
    await linkPackage('@devframes/hub-ui', uiRoot)
  }

  const ownerRequire = createRequire(fixture.packageJsonPath)
  const coreRequire = createRequire(new URL('../../../../package.json', import.meta.url))
  const ownerAuthPath = ownerRequire.resolve('devframe/node/auth')
  const coreAuthPath = coreRequire.resolve('devframe/node/auth')
  expect(ownerAuthPath).not.toBe(coreAuthPath)
  const coreAuth = await import(pathToFileURL(coreAuthPath).href) as { getTempAuthCode: () => string }
  const coreCode = coreAuth.getTempAuthCode()
  const ownerAuth = await import(pathToFileURL(ownerAuthPath).href) as { getTempAuthCode: () => string }
  expect(ownerAuth.getTempAuthCode()).toBe('owner-initial')

  const handle = await startAnalyzeDashboard({ packages: [], modules: [], subPackages: [] }, {
    artifacts: new Map(),
    watch: true,
    uiHost,
    silentStartupLog: true,
  })
  if (!handle) {
    throw new Error('Dashboard did not return its handle')
  }
  try {
    const hostModule = await import(pathToFileURL(ownerRequire.resolve(uiHost === 'hub' ? '@devframes/hub/initiate' : 'devframe/initiate')).href) as {
      getLastHost: () => DevframeInstance & { authenticate: (code: string) => boolean }
    }
    const url = new URL(handle.urls[0]!)
    const code = new URLSearchParams(url.hash.slice(1)).get('devframe_otp')!
    expect(url.pathname).toBe(uiHost === 'hub' ? '/__devframes/' : '/__weapp-vite/')
    expect(code).toBe(ownerAuth.getTempAuthCode())
    expect(code).toBe('owner-1')
    expect(hostModule.getLastHost().authenticate(code)).toBe(true)
    expect(hostModule.getLastHost().authenticate('owner-initial')).toBe(false)
    expect(hostModule.getLastHost().authenticate('foreign-owner-code')).toBe(false)
    expect(coreAuth.getTempAuthCode()).toBe(coreCode)
  }
  finally {
    await handle.close()
    await handle.waitForExit()
  }
})
