import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-template')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const ROUTE = '/pages/layout-feedback/index'

async function runBuild() {
  await fs.rm(DIST_ROOT, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: TEMPLATE_ROOT,
    platform: 'weapp',
    cwd: TEMPLATE_ROOT,
    label: 'ide:template-wevu-tdesign-layout-feedback-dialog',
  })
}

async function tapElement(page: any, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Failed to find tap element: ${selector}`)
  }
  await element.tap()
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

describe.sequential('template e2e: weapp-vite-wevu-tailwindcss-tdesign-template layout feedback dialog', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('closes page alert dialog after tapping confirm button', async () => {
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)

    try {
      const page = await miniProgram.reLaunch(ROUTE)
      if (!page) {
        throw new Error(`Failed to launch route: ${ROUTE}`)
      }

      await page.waitFor(400)
      const marker = collector.mark()

      const opened = await page.callMethod('runPageAlertCloseE2E')
      expect(opened).toMatchObject({
        hasHost: true,
        visible: true,
        hasOnConfirm: true,
        hasNativeConfirm: true,
        title: expect.stringContaining('页面 Alert'),
      })

      await tapElement(page, '.t-dialog__button--confirm')
      await page.waitFor(240)

      const closed = await page.callMethod('inspectDialogHostE2E')
      expect(closed).toMatchObject({
        hasHost: true,
        visible: false,
      })
      expect(await page.callMethod('getLayoutFeedbackLogsE2E')).toContainEqual(expect.stringContaining('页面 Alert'))
      expect(collector.getSince(marker)).toEqual([])
    }
    finally {
      collector.dispose()
    }
  })

  it('closes page confirm dialog after tapping cancel and confirm buttons', async () => {
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)

    try {
      let page = await miniProgram.reLaunch(ROUTE)
      if (!page) {
        throw new Error(`Failed to launch route: ${ROUTE}`)
      }

      await page.waitFor(400)
      let marker = collector.mark()

      let opened = await page.callMethod('runPageConfirmOpenE2E')
      expect(opened).toMatchObject({
        hasHost: true,
        visible: true,
        hasOnConfirm: true,
        hasOnCancel: true,
        hasNativeConfirm: true,
        hasNativeCancel: true,
        title: expect.stringContaining('页面 Confirm'),
      })

      await tapElement(page, '.t-dialog__button--cancel')
      await page.waitFor(240)

      let closed = await page.callMethod('inspectDialogHostE2E')
      expect(closed).toMatchObject({
        hasHost: true,
        visible: false,
      })
      expect(collector.getSince(marker)).toEqual([])

      page = await miniProgram.reLaunch(ROUTE)
      if (!page) {
        throw new Error(`Failed to relaunch route: ${ROUTE}`)
      }
      await page.waitFor(400)
      marker = collector.mark()

      opened = await page.callMethod('runPageConfirmOpenE2E')
      expect(opened.visible).toBe(true)

      await tapElement(page, '.t-dialog__button--confirm')
      await page.waitFor(240)

      closed = await page.callMethod('inspectDialogHostE2E')
      expect(closed).toMatchObject({
        hasHost: true,
        visible: false,
      })

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

    let opened = await page.callMethod('runPageAlertCloseE2E')
    expect(opened.visible).toBe(true)

    let closed = await page.callMethod('runDialogHostConfirmE2E')
    expect(closed.visible).toBe(false)

    opened = await page.callMethod('runPageConfirmOpenE2E')
    expect(opened.visible).toBe(true)

    closed = await page.callMethod('runDialogHostCancelE2E')
    expect(closed.visible).toBe(false)
  })
})
