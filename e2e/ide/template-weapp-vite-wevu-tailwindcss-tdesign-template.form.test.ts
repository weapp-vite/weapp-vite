import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/template-wevu-tdesign-regression')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const ROUTE = '/pages/form/index'

async function runBuild() {
  await fs.rm(DIST_ROOT, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: TEMPLATE_ROOT,
    platform: 'weapp',
    cwd: TEMPLATE_ROOT,
    label: 'ide:template-wevu-tdesign-regression-form',
  })
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await runBuild()
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: TEMPLATE_ROOT,
    })
  }
  return sharedMiniProgram
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close()
}

async function getFormState(page: any) {
  const data = await page.data()
  return {
    currentStep: data.currentStep,
    urgent: data.formState?.urgent,
    pace: data.formState?.pace,
  }
}

async function waitForFormState(page: any, expected: Partial<Awaited<ReturnType<typeof getFormState>>>) {
  await expect.poll(
    () => getFormState(page),
    { interval: 80, timeout: 2000 },
  ).toMatchObject(expected)
}

async function getUrgentRow(page: any) {
  const row = await page.$('.urgent-row-toggle')
  expect(row).toBeTruthy()
  return row!
}

describe.sequential('e2e app: template-wevu-tdesign-regression form', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('toggles urgent state from both the row and the switch', async () => {
    const miniProgram = await getSharedMiniProgram()
    const page = await miniProgram.reLaunch(ROUTE)
    if (!page) {
      throw new Error(`Failed to launch route: ${ROUTE}`)
    }

    await waitForFormState(page, {
      currentStep: 0,
      urgent: false,
      pace: 'balanced',
    })

    await (await getUrgentRow(page)).tap()
    await waitForFormState(page, {
      urgent: true,
      pace: 'fast',
    })

    await (await getUrgentRow(page)).tap()
    await waitForFormState(page, {
      urgent: false,
      pace: 'fast',
    })

    const switchControl = await page.$('.t-switch')
    expect(switchControl).toBeTruthy()
    await switchControl!.tap()
    await waitForFormState(page, {
      urgent: true,
      pace: 'fast',
    })
  })
})
