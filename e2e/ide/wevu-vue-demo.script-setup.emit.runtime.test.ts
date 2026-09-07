import { rm } from 'node:fs/promises'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'
import { EMIT_CASES, EMIT_CHECKPOINTS, EMIT_ROUTE } from './emitMatrixDom'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/wevu-vue-demo')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

async function runBuild() {
  await rm(DIST_ROOT, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ide:wevu-vue-demo-script-setup-emit',
  })
}

async function tapById(page: any, id: string) {
  const buttons = await page.getElementsByXpath(`//button[@id="${id}"]`, { fallback: false })
  expect(buttons, id).toHaveLength(1)
  await buttons[0].tap()
}

let miniProgram: any

describe('wevu-vue-demo script setup emit runtime', { concurrent: false }, () => {
  beforeAll(async () => {
    await runBuild()
    miniProgram = await launchAutomator({ projectPath: APP_ROOT, skipWarmup: true })
  }, 240_000)

  afterAll(async () => {
    await miniProgram?.close()
  })

  it('unwraps emitted detail for handler / $event / inline $event.title and preserves native event payloads', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'apps/wevu-vue-demo', EMIT_CHECKPOINTS)
    const page = await miniProgram.reLaunch(EMIT_ROUTE)
    await dom.check('initial', miniProgram, page)
    await tapById(page, 'emit-matrix-reset')
    await dom.check('reset', miniProgram, page)

    for (const testCase of EMIT_CASES) {
      await tapById(page, testCase.id)
      await dom.check(testCase.id, miniProgram, page)
      const records = await page.data('emitMatrixRecords', { fallback: false })
      expect(records[0]).toMatchObject(testCase.expected)
    }
  })
})
