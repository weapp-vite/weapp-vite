import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import { Launcher } from '@weapp-vite/miniprogram-automator'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const SWAN_ENDPOINT = process.env.WEAPP_VITE_SWAN_WS_ENDPOINT?.trim()
const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(
  import.meta.dirname,
  '../../templates/weapp-vite-multi-platform-sfc-template',
)
const PROJECT_ROOT = path.join(TEMPLATE_ROOT, 'dist/swan')
const INDEX_ROUTE = '/pages/index/index'

const describeSwanRuntime = SWAN_ENDPOINT ? describe : describe.skip

describeSwanRuntime('optional multi-platform SFC template Baidu runtime smoke', { concurrent: false }, () => {
  let device: any
  let smartapp: any

  beforeAll(async () => {
    await fs.remove(PROJECT_ROOT)
    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: TEMPLATE_ROOT,
      platform: 'swan',
      skipNpm: true,
      label: 'ide:multi-platform-sfc-template:swan',
    })
    const launcher = new Launcher()
    device = await launcher.connect({
      platform: 'swan',
      wsEndpoint: SWAN_ENDPOINT!,
      timeout: 30_000,
    })
    smartapp = await device.newSmartapp('devtools', 'weapp-vite-multi-platform-sfc-template')
  }, 120_000)

  afterAll(async () => {
    await device?.close()
  })

  it('reuses one session and exposes the SFC runtime state', async () => {
    const page = await smartapp.goto(INDEX_ROUTE, { retry: 2, timeout: 30_000 })
    expect(page.path).toBe(INDEX_ROUTE)
    await expect(page.data()).resolves.toMatchObject({
      count: 0,
      doubled: 0,
      platform: 'swan',
      status: 'ready',
    })
  })
})
