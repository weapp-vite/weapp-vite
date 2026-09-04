import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import { Launcher } from '@weapp-vite/miniprogram-automator'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const SWAN_ENDPOINT = process.env.WEAPP_VITE_SWAN_WS_ENDPOINT?.trim()
const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/base')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const INDEX_ROUTE = '/pages/index/index'

const describeSwanRuntime = SWAN_ENDPOINT ? describe : describe.skip

describeSwanRuntime('optional Baidu runtime smoke', { concurrent: false }, () => {
  let device: any
  let smartapp: any

  beforeAll(async () => {
    await fs.remove(DIST_ROOT)
    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: APP_ROOT,
      platform: 'swan',
      skipNpm: true,
      label: 'ide:swan-runtime',
    })
    const launcher = new Launcher()
    device = await launcher.connect({
      platform: 'swan',
      wsEndpoint: SWAN_ENDPOINT!,
      timeout: 30_000,
    })
    smartapp = await device.newSmartapp('devtools', 'e2e-base')
  }, 120_000)

  afterAll(async () => {
    await device?.close()
  })

  it('reuses one session and relaunches the index route', async () => {
    const page = await smartapp.goto(INDEX_ROUTE, { retry: 2, timeout: 30_000 })
    expect(page.path).toBe(INDEX_ROUTE)
    await expect(page.data()).resolves.toMatchObject({
      __e2eData: {
        greeting: 'Hello',
        target: 'index snapshot',
      },
      __e2eResult: {
        status: 'ready',
        detail: 'rendered',
      },
    })
  })
})
