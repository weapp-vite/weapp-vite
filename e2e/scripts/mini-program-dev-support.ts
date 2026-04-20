import path from 'node:path'
import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { APP_ROOT, CLI_PATH, DIST_ROOT } from '../wevu-runtime.utils'

const INITIAL_BUILD_READY_RE = /小程序初次构建完成[\s\S]*开发服务已就绪/
const FORCE_HMR_GUARD_ENV = 'WEAPP_VITE_E2E_FORCE_HMR_GUARD'

let cachedDiskBackedDevSupport: Promise<boolean> | undefined

async function probeDiskBackedMiniProgramDev() {
  await cleanupResidualDevProcesses()
  await fs.remove(DIST_ROOT)

  const dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
    env: createDevProcessEnv(),
    all: true,
  })

  try {
    await dev.waitForOutput(INITIAL_BUILD_READY_RE, 'initial mini-program dev build ready', 30_000)
    return await fs.pathExists(path.join(DIST_ROOT, 'app.json'))
  }
  finally {
    await dev.stop(5_000)
    await cleanupResidualDevProcesses()
  }
}

export function shouldForceDiskBackedMiniProgramDevChecks(env = process.env) {
  return env[FORCE_HMR_GUARD_ENV] === '1'
}

export async function supportsDiskBackedMiniProgramDev() {
  cachedDiskBackedDevSupport ??= probeDiskBackedMiniProgramDev()
  return await cachedDiskBackedDevSupport
}

export { FORCE_HMR_GUARD_ENV }
