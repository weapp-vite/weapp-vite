import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/template-wevu-tdesign-regression')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const ROUTE = '/pages/layout-feedback/index'

async function runBuild() {
  await fs.rm(DIST_ROOT, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: TEMPLATE_ROOT,
    platform: 'weapp',
    cwd: TEMPLATE_ROOT,
    label: 'ide:template-wevu-tdesign-regression-layout-feedback-dialog',
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

describe.sequential('e2e app: template-wevu-tdesign-regression layout feedback dialog', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('closes page alert dialog after confirming', async () => {
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)

    try {
      const page = await miniProgram.reLaunch(ROUTE)
      if (!page) {
        throw new Error(`Failed to launch route: ${ROUTE}`)
      }

      await page.waitFor(400)
      const marker = collector.mark()

      expect(await page.callMethod('runPageAlertCloseE2E')).toMatchObject({
        hasHost: true,
        visible: true,
        hasOnConfirm: true,
      })

      expect(await page.callMethod('runDialogHostConfirmE2E')).toMatchObject({
        hasHost: true,
        visible: false,
      })
      const actionLogs = await page.callMethod('getLayoutFeedbackLogsE2E')
      expect(actionLogs).toContainEqual(expect.stringContaining('页面 Alert'))
      expect(actionLogs).toContainEqual(expect.stringContaining('已确认'))
      expect(collector.getSince(marker)).toEqual([])
    }
    finally {
      collector.dispose()
    }
  })

  it('closes page confirm dialog after canceling and confirming', async () => {
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)

    try {
      let page = await miniProgram.reLaunch(ROUTE)
      if (!page) {
        throw new Error(`Failed to launch route: ${ROUTE}`)
      }

      await page.waitFor(400)
      let marker = collector.mark()

      expect(await page.callMethod('runPageConfirmOpenE2E')).toMatchObject({
        hasHost: true,
        visible: true,
        hasOnConfirm: true,
        hasOnCancel: true,
      })

      expect(await page.callMethod('runDialogHostCancelE2E')).toMatchObject({
        hasHost: true,
        visible: false,
      })
      let actionLogs = await page.callMethod('getLayoutFeedbackLogsE2E')
      expect(actionLogs).toContainEqual(expect.stringContaining('页面 Confirm'))
      expect(actionLogs).toContainEqual(expect.stringContaining('点击取消'))
      expect(collector.getSince(marker)).toEqual([])

      page = await miniProgram.reLaunch(ROUTE)
      if (!page) {
        throw new Error(`Failed to relaunch route: ${ROUTE}`)
      }
      await page.waitFor(400)
      marker = collector.mark()

      expect(await page.callMethod('runPageConfirmOpenE2E')).toMatchObject({
        hasHost: true,
        visible: true,
      })

      expect(await page.callMethod('runDialogHostConfirmE2E')).toMatchObject({
        hasHost: true,
        visible: false,
      })
      actionLogs = await page.callMethod('getLayoutFeedbackLogsE2E')
      expect(actionLogs).toContainEqual(expect.stringContaining('页面 Confirm'))
      expect(actionLogs).toContainEqual(expect.stringContaining('点击确认'))

      expect(collector.getSince(marker)).toEqual([])
    }
    finally {
      collector.dispose()
    }
  })

  it('can close dialog host via native confirm/cancel methods', async () => {
    const miniProgram = await getSharedMiniProgram()

    const page = await miniProgram.reLaunch(ROUTE)
    if (!page) {
      throw new Error(`Failed to launch route: ${ROUTE}`)
    }

    await page.waitFor(400)

    expect(await page.callMethod('runPageAlertCloseE2E')).toMatchObject({
      hasHost: true,
      visible: true,
    })
    expect(await page.callMethod('runDialogHostConfirmE2E')).toMatchObject({
      hasHost: true,
      visible: false,
    })

    expect(await page.callMethod('runPageConfirmOpenE2E')).toMatchObject({
      hasHost: true,
      visible: true,
    })
    expect(await page.callMethod('runDialogHostCancelE2E')).toMatchObject({
      hasHost: true,
      visible: false,
    })
  })
})
