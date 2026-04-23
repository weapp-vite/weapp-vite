import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { relaunchPage, waitForCurrentPagePath } from './github-issues.runtime.shared'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_NATIVE_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-lifecycle-native')
const APP_WEVU_TS_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-lifecycle-wevu-ts')
const APP_WEVU_VUE_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-lifecycle-wevu-vue')
const APP_HOOKS = [
  'onLaunch',
  'onShow',
  'onHide',
  'onError',
  'onPageNotFound',
  'onUnhandledRejection',
  'onThemeChange',
]

async function runBuild(root: string) {
  const distRoot = path.join(root, 'dist')
  await fs.remove(distRoot)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: root,
    platform: 'weapp',
    skipNpm: true,
    label: `ide:app-lifecycle:${path.basename(root)}`,
  })
}

const sharedBuildPreparedRoots = new Set<string>()

async function launchFreshMiniProgram(root: string) {
  await cleanupResidualIdeProcesses()

  if (!sharedBuildPreparedRoots.has(root)) {
    await runBuild(root)
    sharedBuildPreparedRoots.add(root)
  }

  return await launchAutomator({
    projectPath: root,
  })
}

async function closeSharedMiniPrograms() {
  await cleanupResidualIdeProcesses()
}

async function collectAppLogs(root: string) {
  const miniProgram = await launchFreshMiniProgram(root)
  try {
    const page = await waitForCurrentPagePath(miniProgram, '/pages/index/index', 30_000)
      ?? await relaunchPage(miniProgram, '/pages/index/index', undefined, 30_000)
    if (!page) {
      throw new Error('Failed to launch /pages/index/index')
    }
    await page.waitFor(300)
    const logs = await miniProgram.evaluate(() => {
      const app = getApp()
      if (typeof app?.finalizeLifecycleLogs === 'function') {
        app.finalizeLifecycleLogs()
      }
      return app?.globalData?.__lifecycleLogs ?? []
    })
    return logs ?? []
  }
  finally {
    await miniProgram.close().catch(() => {})
  }
}

function normalizeEntries(entries: any[]) {
  const normalized = entries.map(({ source, ...rest }) => rest)
  const seenHooks = new Set(normalized.map(entry => String(entry?.hook ?? '')))

  for (const hook of APP_HOOKS) {
    if (seenHooks.has(hook)) {
      continue
    }
    normalized.push({
      hook,
      order: normalized.length + 1,
      args: null,
      skipped: true,
      snapshot: {
        lastHook: hook,
        tick: normalized.length + 1,
      },
    })
  }

  return normalized
}

describe.sequential('app lifecycle compare (e2e)', () => {
  afterAll(async () => {
    await closeSharedMiniPrograms()
  })

  it('compares wevu app lifecycle logs against native', async () => {
    const nativeLogs = await collectAppLogs(APP_NATIVE_ROOT)
    const wevuTsLogs = await collectAppLogs(APP_WEVU_TS_ROOT)
    const wevuVueLogs = await collectAppLogs(APP_WEVU_VUE_ROOT)

    expect(nativeLogs.length).toBeGreaterThan(0)
    expect(normalizeEntries(wevuTsLogs)).toEqual(normalizeEntries(nativeLogs))
    expect(normalizeEntries(wevuVueLogs)).toEqual(normalizeEntries(nativeLogs))
  })
})
