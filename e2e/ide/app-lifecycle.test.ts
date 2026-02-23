import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_NATIVE_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-lifecycle-native')
const APP_WEVU_TS_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-lifecycle-wevu-ts')
const APP_WEVU_VUE_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-lifecycle-wevu-vue')

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

async function collectAppLogs(root: string) {
  await runBuild(root)
  const miniProgram = await launchAutomator({
    projectPath: root,
  })
  try {
    await miniProgram.reLaunch('/pages/index/index')
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
    await miniProgram.close()
  }
}

function normalizeEntries(entries: any[]) {
  return entries.map(({ source, ...rest }) => rest)
}

describe.sequential('app lifecycle compare (e2e)', () => {
  it('compares wevu app lifecycle logs against native', async () => {
    const nativeLogs = await collectAppLogs(APP_NATIVE_ROOT)
    const wevuTsLogs = await collectAppLogs(APP_WEVU_TS_ROOT)
    const wevuVueLogs = await collectAppLogs(APP_WEVU_VUE_ROOT)

    expect(nativeLogs.length).toBeGreaterThan(0)
    expect(normalizeEntries(wevuTsLogs)).toEqual(normalizeEntries(nativeLogs))
    expect(normalizeEntries(wevuVueLogs)).toEqual(normalizeEntries(nativeLogs))
  })
})
