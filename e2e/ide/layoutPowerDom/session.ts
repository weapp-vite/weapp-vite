import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import process from 'node:process'
import path from 'pathe'
import { resolveProjectAutomatorPort } from 'weapp-ide-cli'
import { cleanupTrackedDevProcesses, startDevProcess } from '../../utils/dev-process'
import { createDevProcessEnv } from '../../utils/dev-process-env'
import { waitForFileContains, waitForStatefulHmrControl } from '../../utils/hmr-helpers'
import { cleanupResidualIdeProcesses } from '../../utils/ide-devtools-cleanup'
import { waitForOpenedAutomator } from '../../utils/opened-automator'
import { attachRuntimeErrorCollector } from '../runtimeErrors'

export const APP_ROOT = path.resolve(import.meta.dirname, '../../../apps/layout-power-demo')
export const DIST_ROOT = path.join(APP_ROOT, 'dist')

function sessionFile(port?: number) {
  const key = port ? `${APP_ROOT}#port-${port}` : APP_ROOT
  return path.join(os.tmpdir(), 'weapp-vite-automator-sessions', `${Buffer.from(key).toString('base64url')}.json`)
}

export async function prepareLayoutPowerSession() {
  await fs.rm(sessionFile(), { force: true })
  await fs.rm(sessionFile(resolveProjectAutomatorPort(APP_ROOT)), { force: true })
  await fs.rm(DIST_ROOT, { recursive: true, force: true })
  await cleanupResidualIdeProcesses()
}

export async function startLayoutPowerSession() {
  const cliPath = path.join(APP_ROOT, 'node_modules/weapp-vite/bin/weapp-vite.js')
  const devProcess = startDevProcess(process.execPath, [cliPath, 'dev', '-o', '--non-interactive', '--login-retry', 'never'], {
    cwd: APP_ROOT,
    all: true,
    env: createDevProcessEnv(),
    reject: false,
  })
  try {
    await devProcess.waitFor(waitForFileContains(path.join(DIST_ROOT, 'pages/index/index.wxml'), 'layout-power-index-page', 90_000), 'layout-power page template')
    await devProcess.waitFor(waitForStatefulHmrControl(path.join(DIST_ROOT, '__weapp_vite_hmr/control.js'), 90_000), 'layout-power HMR control')
    const { miniProgram } = await devProcess.waitFor(waitForOpenedAutomator(APP_ROOT, { connectTimeoutMs: 5_000, timeoutMs: 180_000 }), 'layout-power automator')
    const collector = attachRuntimeErrorCollector(miniProgram)
    return {
      devProcess,
      miniProgram,
      collector,
      async close() {
        collector.dispose()
        try {
          await miniProgram.close()
        }
        finally {
          await devProcess.stop()
          await cleanupTrackedDevProcesses()
        }
      },
    }
  }
  catch (error) {
    await devProcess.stop()
    await cleanupTrackedDevProcesses()
    throw error
  }
}

export type LayoutPowerSession = Awaited<ReturnType<typeof startLayoutPowerSession>>
