import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/chunk-modes')
const CONFIG_PATH = path.join(APP_ROOT, 'weapp-vite.config.ts')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

interface RuntimeRouteCase {
  route: string
  expectedTokens: string[]
}

interface RuntimeMatrixCase {
  id: string
  env: Record<string, string>
  routes: RuntimeRouteCase[]
}

const baseRoutes: RuntimeRouteCase[] = [
  {
    route: '/pages/index/index',
    expectedTokens: ['__COMMON_MARKER__', '__PATH_ONLY_MARKER__', '__INLINE_ONLY_MARKER__', '__VENDOR_MARKER__'],
  },
  {
    route: '/packageA/pages/foo',
    expectedTokens: ['__COMMON_MARKER__', '__SUB_ONLY_MARKER__', '__PATH_ONLY_MARKER__', '__INLINE_ONLY_MARKER__', '__VENDOR_MARKER__'],
  },
  {
    route: '/packageB/pages/bar',
    expectedTokens: ['__COMMON_MARKER__', '__SUB_ONLY_MARKER__', '__INLINE_ONLY_MARKER__', '__VENDOR_MARKER__'],
  },
]

const runtimeCases: RuntimeMatrixCase[] = [
  { id: 'duplicate-common-preserve', env: { WEAPP_CHUNK_STRATEGY: 'duplicate', WEAPP_CHUNK_MODE: 'common', WEAPP_CHUNK_DYNAMIC: 'preserve', WEAPP_CHUNK_OVERRIDE: 'none' }, routes: baseRoutes },
  { id: 'hoist-common-preserve', env: { WEAPP_CHUNK_STRATEGY: 'hoist', WEAPP_CHUNK_MODE: 'common', WEAPP_CHUNK_DYNAMIC: 'preserve', WEAPP_CHUNK_OVERRIDE: 'none' }, routes: baseRoutes },
  { id: 'duplicate-path-preserve', env: { WEAPP_CHUNK_STRATEGY: 'duplicate', WEAPP_CHUNK_MODE: 'path', WEAPP_CHUNK_DYNAMIC: 'preserve', WEAPP_CHUNK_OVERRIDE: 'none' }, routes: baseRoutes },
  { id: 'hoist-path-preserve', env: { WEAPP_CHUNK_STRATEGY: 'hoist', WEAPP_CHUNK_MODE: 'path', WEAPP_CHUNK_DYNAMIC: 'preserve', WEAPP_CHUNK_OVERRIDE: 'none' }, routes: baseRoutes },
  { id: 'duplicate-inline-preserve', env: { WEAPP_CHUNK_STRATEGY: 'duplicate', WEAPP_CHUNK_MODE: 'inline', WEAPP_CHUNK_DYNAMIC: 'preserve', WEAPP_CHUNK_OVERRIDE: 'none' }, routes: baseRoutes },
  { id: 'hoist-inline-preserve', env: { WEAPP_CHUNK_STRATEGY: 'hoist', WEAPP_CHUNK_MODE: 'inline', WEAPP_CHUNK_DYNAMIC: 'preserve', WEAPP_CHUNK_OVERRIDE: 'none' }, routes: baseRoutes },
  { id: 'duplicate-common-mixed-inline', env: { WEAPP_CHUNK_STRATEGY: 'duplicate', WEAPP_CHUNK_MODE: 'common', WEAPP_CHUNK_DYNAMIC: 'inline', WEAPP_CHUNK_OVERRIDE: 'mixed' }, routes: baseRoutes },
  { id: 'duplicate-path-shared-root', env: { WEAPP_CHUNK_STRATEGY: 'duplicate', WEAPP_CHUNK_MODE: 'path', WEAPP_CHUNK_DYNAMIC: 'preserve', WEAPP_CHUNK_OVERRIDE: 'none', WEAPP_CHUNK_SHARED_PATH_ROOT: 'shared' }, routes: baseRoutes },
  { id: 'duplicate-path-invalid-root', env: { WEAPP_CHUNK_STRATEGY: 'duplicate', WEAPP_CHUNK_MODE: 'path', WEAPP_CHUNK_DYNAMIC: 'preserve', WEAPP_CHUNK_OVERRIDE: 'none', WEAPP_CHUNK_SHARED_PATH_ROOT: 'invalid' }, routes: baseRoutes },
]

const openMiniPrograms = new Set<any>()

async function runBuild(env: Record<string, string>, label: string) {
  await fs.remove(DIST_ROOT)

  const result = await execa('node', [
    CLI_PATH,
    'build',
    APP_ROOT,
    '--platform',
    'weapp',
    '--skipNpm',
    '--config',
    CONFIG_PATH,
  ], {
    cwd: APP_ROOT,
    env: {
      ...process.env,
      ...env,
      WEAPP_CHUNK_OUTDIR: 'dist',
    },
    reject: false,
    all: true,
  })

  if ((result.exitCode ?? 1) !== 0) {
    throw new Error(`[${label}] build failed\n${result.all ?? ''}`)
  }
}

async function closeMiniProgram(miniProgram: any) {
  if (!miniProgram) {
    return
  }
  openMiniPrograms.delete(miniProgram)
  await miniProgram.close()
}

describe.sequential('e2e app: chunk-modes runtime matrix', () => {
  afterAll(async () => {
    await Promise.all(Array.from(openMiniPrograms).map(async miniProgram => closeMiniProgram(miniProgram)))
  })

  for (const runtimeCase of runtimeCases) {
    it(`runs without runtime errors in devtools for ${runtimeCase.id}`, async () => {
      await runBuild(runtimeCase.env, runtimeCase.id)

      const miniProgram = await launchAutomator({
        projectPath: APP_ROOT,
      })
      openMiniPrograms.add(miniProgram)

      try {
        for (const routeCase of runtimeCase.routes) {
          const page = await miniProgram.reLaunch(routeCase.route)
          if (!page) {
            throw new Error(`[${runtimeCase.id}] failed to launch route: ${routeCase.route}`)
          }

          await page.waitFor(520)

          const result = await page.callMethod('_runE2E')
          expect(result?.ok).toBe(true)
          expect(result?.tokens).toEqual(expect.arrayContaining(routeCase.expectedTokens))
        }
      }
      finally {
        await closeMiniProgram(miniProgram)
      }
    })
  }
})
