import { execa } from 'execa'
import fs from 'fs-extra'
import automator from 'miniprogram-automator'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/bin/weapp-vite.js')
const APP_NATIVE_ROOT = path.resolve(import.meta.dirname, '../e2e-apps/app-lifecycle-native')
const APP_WEVU_ROOT = path.resolve(import.meta.dirname, '../e2e-apps/app-lifecycle-wevu')

async function runBuild(root: string, mode?: string) {
  const distRoot = path.join(root, 'dist')
  await fs.remove(distRoot)
  const args = [CLI_PATH, 'build', root, '--platform', 'weapp', '--skipNpm']
  if (mode) {
    args.push('--mode', mode)
  }
  await execa('node', args, {
    stdio: 'inherit',
  })
}

async function collectAppLogs(root: string, mode?: string) {
  const distRoot = path.join(root, 'dist')
  await runBuild(root, mode)
  const miniProgram = await automator.launch({
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
    await fs.remove(distRoot)
  }
}

function normalizeEntries(entries: any[]) {
  return entries.map(({ source, ...rest }) => rest)
}

describe.sequential('app lifecycle compare (e2e)', () => {
  it('compares wevu app lifecycle logs against native', async () => {
    const nativeLogs = await collectAppLogs(APP_NATIVE_ROOT)
    const wevuTsLogs = await collectAppLogs(APP_WEVU_ROOT, 'ts')
    const wevuVueLogs = await collectAppLogs(APP_WEVU_ROOT, 'vue')

    expect(nativeLogs.length).toBeGreaterThan(0)
    expect(normalizeEntries(wevuTsLogs)).toEqual(normalizeEntries(nativeLogs))
    expect(normalizeEntries(wevuVueLogs)).toEqual(normalizeEntries(nativeLogs))
  })
})
