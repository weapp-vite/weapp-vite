import { rm } from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/vite-native-ts')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const ROUTE = '/pages/index/index'

let miniProgram: any = null
let buildPrepared = false

async function ensureBuilt() {
  if (buildPrepared) {
    return
  }

  await rm(DIST_ROOT, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ide:vite-native-ts-worker',
  })
  buildPrepared = true
}

async function getMiniProgram(ctx: { skip: (message?: string) => void }) {
  if (miniProgram) {
    return miniProgram
  }

  await ensureBuilt()

  try {
    miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })
    return miniProgram
  }
  catch (error) {
    if (isDevtoolsHttpPortError(error)) {
      ctx.skip('WeChat DevTools 服务端口未开启，跳过 vite-native-ts worker IDE 自动化用例。')
    }
    throw error
  }
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForWorkerReady(page: any, timeoutMs = 12_000) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    const workerStatus = await page.data('workerStatus')
    const workerMessage = await page.data('workerMessage')
    if (workerStatus === 'ready') {
      return {
        workerStatus,
        workerMessage,
      }
    }
    await wait(240)
  }
  return {
    workerStatus: await page.data('workerStatus'),
    workerMessage: await page.data('workerMessage'),
  }
}

describe.sequential('e2e app: vite-native-ts worker runtime', () => {
  afterAll(async () => {
    if (miniProgram) {
      await miniProgram.close()
    }
  })

  it('preloads worker subpackage and receives the first worker message without runtime errors', async (ctx) => {
    const miniProgram = await getMiniProgram(ctx)
    const collector = attachRuntimeErrorCollector(miniProgram)
    const marker = collector.mark()

    try {
      const page = await miniProgram.reLaunch(ROUTE)
      if (!page) {
        throw new Error(`Failed to launch ${ROUTE}`)
      }

      const workerState = await waitForWorkerReady(page)
      expect(workerState.workerStatus).toBe('ready')
      expect(workerState.workerMessage).toBe('hello')
      expect(collector.getSince(marker)).toEqual([])
    }
    finally {
      collector.dispose()
    }
  })
})
