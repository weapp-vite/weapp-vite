import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import process from 'node:process'
import path from 'pathe'
import { resolveProjectAutomatorPort } from 'weapp-ide-cli'
import { launchAutomator } from '../../utils/automator'
import { cleanupTrackedDevProcesses, startDevProcess } from '../../utils/dev-process'
import { createDevProcessEnv } from '../../utils/dev-process-env'
import { withDevProcessShutdownTrace } from '../../utils/devProcessShutdownTrace'
import { waitForFileContains, waitForStatefulHmrControl } from '../../utils/hmr-helpers'
import { cleanupResidualIdeProcesses } from '../../utils/ide-devtools-cleanup'
import { waitForOpenedAutomator } from '../../utils/opened-automator'
import { resolveRuntimeProviderName } from '../../utils/runtimeProvider'
import { attachRuntimeErrorCollector } from '../runtimeErrors'

export const APP_ROOT = path.resolve(import.meta.dirname, '../../../apps/layout-power-demo')
export const DIST_ROOT = path.join(APP_ROOT, 'dist')

function sessionFile(port?: number) {
  const key = port ? `${APP_ROOT}#port-${port}` : APP_ROOT
  return path.join(os.tmpdir(), 'weapp-vite-automator-sessions', `${Buffer.from(key).toString('base64url')}.json`)
}

export async function prepareLayoutPowerSession() {
  const usesDevtools = resolveRuntimeProviderName() === 'devtools'
  if (usesDevtools) {
    await fs.rm(sessionFile(), { force: true })
    await fs.rm(sessionFile(resolveProjectAutomatorPort(APP_ROOT)), { force: true })
  }
  await fs.rm(DIST_ROOT, { recursive: true, force: true })
  if (usesDevtools) {
    await cleanupResidualIdeProcesses()
  }
}

interface LayoutPowerSessionOptions {
  requireStatefulHmr?: boolean
}

export async function startLayoutPowerSession(options: LayoutPowerSessionOptions = {}) {
  const cliPath = path.join(APP_ROOT, 'node_modules/weapp-vite/bin/weapp-vite.js')
  const isHeadless = resolveRuntimeProviderName() === 'headless'
  // 真实 IDE 由开发命令打开；headless 在初构后由测试进程创建容器，避免启动微信宿主。
  const devProcess = startDevProcess(process.execPath, [
    cliPath,
    'dev',
    ...(isHeadless ? [] : ['-o', '--ide-open-strategy', 'automator']),
    '--non-interactive',
    '--login-retry',
    'never',
  ], {
    cwd: APP_ROOT,
    all: true,
    env: withDevProcessShutdownTrace(createDevProcessEnv()),
    reject: false,
  })
  let miniProgram: Awaited<ReturnType<typeof waitForOpenedAutomator>>['miniProgram'] | undefined
  let collector: ReturnType<typeof attachRuntimeErrorCollector> | undefined
  const close = async (errors: unknown[] = []) => {
    for (const cleanup of [
      () => collector?.dispose(),
      () => miniProgram?.close(),
      () => devProcess.stop(),
      () => cleanupTrackedDevProcesses(),
    ]) {
      try {
        await cleanup()
      }
      catch (error) {
        errors.push(error)
      }
    }
    if (errors.length === 1) {
      throw errors[0]
    }
    if (errors.length > 1) {
      throw new AggregateError(errors, 'Layout power session failed and cleanup did not complete', { cause: errors[0] })
    }
  }
  try {
    await devProcess.waitForInitialBuild(90_000)
    await devProcess.waitFor(waitForFileContains(path.join(DIST_ROOT, 'pages/index/index.wxml'), 'layout-power-index-page', 90_000), 'layout-power page template')
    if (options.requireStatefulHmr) {
      await devProcess.waitFor(waitForStatefulHmrControl(path.join(DIST_ROOT, '__weapp_vite_hmr/control.js'), 90_000), 'layout-power HMR control')
    }
    const connected: Awaited<ReturnType<typeof waitForOpenedAutomator>>['miniProgram'] = isHeadless
      ? await devProcess.waitFor(launchAutomator({ projectPath: APP_ROOT }), 'layout-power headless automator')
      : (await devProcess.waitFor(waitForOpenedAutomator(APP_ROOT, { connectTimeoutMs: 5_000, timeoutMs: 180_000 }), 'layout-power automator')).miniProgram
    miniProgram = connected
    collector = attachRuntimeErrorCollector(miniProgram)
    return {
      devProcess,
      miniProgram,
      collector,
      close: () => close(),
    }
  }
  catch (error) {
    await close([error])
    throw error
  }
}

export type LayoutPowerSession = Awaited<ReturnType<typeof startLayoutPowerSession>>
