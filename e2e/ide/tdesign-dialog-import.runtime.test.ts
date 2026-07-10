import { rm } from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/tdesign-dialog-import')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const RENDER_TIMEOUT = 20_000

let buildPrepared = false
let miniProgram: any = null
let sharedInfraUnavailableMessage = ''

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
    label: 'ide:tdesign-dialog-import',
  })
  buildPrepared = true
}

async function getMiniProgram(ctx: { skip: (message?: string) => void }) {
  if (sharedInfraUnavailableMessage) {
    ctx.skip(sharedInfraUnavailableMessage)
    throw new Error(sharedInfraUnavailableMessage)
  }

  if (miniProgram) {
    return miniProgram
  }

  await ensureBuilt()

  try {
    miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      skipRelaunchPageRootCheck: true,
      warmupRootSelectors: ['#tdesign-dialog-import-home'],
      warmupRoute: '/pages/index/index',
    })
    return miniProgram
  }
  catch (error) {
    if (isDevtoolsHttpPortError(error)) {
      sharedInfraUnavailableMessage = 'WeChat DevTools 服务端口未开启，跳过 tdesign-dialog-import IDE 自动化用例。'
      ctx.skip(sharedInfraUnavailableMessage)
    }
    throw error
  }
}

async function resetMiniProgram() {
  if (!miniProgram) {
    return
  }
  const current = miniProgram
  miniProgram = null
  await current.close().catch(() => {})
}

async function waitForRenderedSelector(page: any, selector: string) {
  if (typeof page?.waitForRendered === 'function') {
    await page.waitForRendered({
      selector,
      timeout: RENDER_TIMEOUT,
    })
    return
  }

  const startedAt = Date.now()
  while (Date.now() - startedAt <= RENDER_TIMEOUT) {
    const element = await page.$(selector)
    if (element) {
      return
    }
    await page.waitFor(220)
  }

  throw new Error(`Timed out waiting rendered selector: ${selector}`)
}

async function triggerRenderedHandler(page: any, selector: string, method: string) {
  await waitForRenderedSelector(page, selector)
  await page.callMethod(method)
  await page.waitFor(240)
}

async function readPageDebugSnapshot(page: any) {
  try {
    return await page.callMethod('_debugE2E')
  }
  catch (error) {
    return {
      callMethodError: error instanceof Error ? error.message : String(error),
      path: page?.path,
      query: page?.query,
    }
  }
}

async function waitForRuntimeState(
  page: any,
  predicate: (runtime: Record<string, any>) => boolean,
  label: string,
  timeoutMs = 20_000,
) {
  const startedAt = Date.now()
  let lastRuntime: Record<string, any> | null = null
  let lastError: unknown

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await page.callMethod('_runE2E')
      lastRuntime = runtime
      if (runtime && predicate(runtime)) {
        return runtime
      }
    }
    catch (error) {
      lastError = error
    }

    try {
      await page.waitFor(220)
    }
    catch {
    }
  }

  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError ?? '')
  throw new Error(`Timed out waiting for dialog runtime ${label}: runtime=${JSON.stringify(lastRuntime, null, 2)} error=${errorMessage} page=${JSON.stringify(await readPageDebugSnapshot(page))}`)
}

async function waitForDialogRuntime(page: any, timeoutMs = 20_000) {
  return await waitForRuntimeState(
    page,
    runtime => runtime?.confirmType === 'function',
    'ready',
    timeoutMs,
  )
}

async function openRenderedDialogPage(
  ctx: { skip: (message?: string) => void },
  route: string,
  rootSelector: string,
) {
  let lastError: unknown
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const mini = await getMiniProgram(ctx)
    try {
      const page = await mini.reLaunch(route)
      if (!page) {
        throw new Error(`Failed to launch ${route}`)
      }

      await page.waitFor(600)
      await waitForRenderedSelector(page, rootSelector)
      await waitForDialogRuntime(page)
      return {
        miniProgram: mini,
        page,
      }
    }
    catch (error) {
      lastError = error
      if (attempt === 2) {
        break
      }
      await resetMiniProgram()
    }
  }
  throw lastError
}

async function verifyDialogPageFlow(
  page: any,
  collector: ReturnType<typeof attachRuntimeErrorCollector>,
  options: {
    openSelector: string
    title: string
  },
) {
  await page.callMethod('_resetE2E')
  const reset = await waitForRuntimeState(
    page,
    runtime => runtime.openCount === 0 && runtime.settleCount === 0 && runtime.lastAction === 'idle',
    'reset',
  )
  expect(reset).toMatchObject({
    confirmType: 'function',
    openCount: 0,
    settleCount: 0,
    dialogVisible: false,
    lastAction: 'idle',
    lastTrigger: 'idle',
    lastError: '',
    lastPayload: '',
    lastReturnedPromise: false,
  })

  const openMarker = collector.mark()
  await triggerRenderedHandler(page, options.openSelector, 'onOpenDialog')
  const opened = await waitForRuntimeState(
    page,
    runtime => runtime.openCount === 1 && runtime.dialogVisible === true && runtime.lastAction === 'opening',
    'open',
  )
  expect(opened).toMatchObject({
    confirmType: 'function',
    openCount: 1,
    settleCount: 0,
    dialogVisible: true,
    lastAction: 'opening',
    lastTrigger: 'user-tap',
    lastError: '',
    lastPayload: '',
    lastTitle: options.title,
    lastReturnedPromise: true,
  })
  expect(collector.getSince(openMarker)).toEqual([])

  const cancelMarker = collector.mark()
  await page.callMethod('_cancelDialogE2E')
  const cancelled = await waitForRuntimeState(
    page,
    runtime => runtime.openCount === 1 && runtime.settleCount === 1 && runtime.dialogVisible === false && runtime.lastAction === 'cancelled',
    'cancel',
  )
  expect(cancelled).toMatchObject({
    confirmType: 'function',
    openCount: 1,
    settleCount: 1,
    dialogVisible: false,
    lastAction: 'cancelled',
    lastTrigger: 'user-tap',
    lastError: '{"trigger":"cancel"}',
    lastPayload: '{"trigger":"cancel"}',
    lastTitle: options.title,
    lastReturnedPromise: true,
  })
  expect(collector.getSince(cancelMarker)).toEqual([])

  const reopenMarker = collector.mark()
  await page.callMethod('_openDialogE2E')
  const reopened = await waitForRuntimeState(
    page,
    runtime => runtime.openCount === 2 && runtime.settleCount === 1 && runtime.dialogVisible === true && runtime.lastAction === 'opening',
    'reopen',
  )
  expect(reopened).toMatchObject({
    confirmType: 'function',
    openCount: 2,
    settleCount: 1,
    dialogVisible: true,
    lastAction: 'opening',
    lastTrigger: 'e2e',
    lastError: '',
    lastPayload: '',
    lastTitle: options.title,
    lastReturnedPromise: true,
  })
  expect(collector.getSince(reopenMarker)).toEqual([])

  const confirmMarker = collector.mark()
  await page.callMethod('_confirmDialogE2E')
  const confirmed = await waitForRuntimeState(
    page,
    runtime => runtime.openCount === 2 && runtime.settleCount === 2 && runtime.dialogVisible === false && runtime.lastAction === 'confirmed',
    'confirm',
  )
  expect(confirmed).toMatchObject({
    confirmType: 'function',
    openCount: 2,
    settleCount: 2,
    dialogVisible: false,
    lastAction: 'confirmed',
    lastTrigger: 'e2e',
    lastError: '',
    lastTitle: options.title,
    lastReturnedPromise: true,
  })
  expect(collector.getSince(confirmMarker)).toEqual([])
}

async function verifyToastPageFlow(
  page: any,
  collector: ReturnType<typeof attachRuntimeErrorCollector>,
  options: {
    toastSelector: string
    message: string
  },
) {
  const toastMarker = collector.mark()
  await triggerRenderedHandler(page, options.toastSelector, 'onOpenToast')
  const shown = await waitForRuntimeState(
    page,
    runtime => runtime.toastCount === 1 && runtime.lastToastAction === 'shown',
    'toast',
  )
  expect(shown).toMatchObject({
    toastType: 'function',
    toastCount: 1,
    lastToastAction: 'shown',
    lastToastTrigger: 'user-tap',
    lastToastError: '',
    lastToastMessage: options.message,
  })
  expect(collector.getSince(toastMarker)).toEqual([])
}

afterAll(async () => {
  await resetMiniProgram()
})

describe.sequential('e2e app: tdesign-dialog-import (runtime)', () => {
  it('keeps bare dialog import callable in DevTools runtime', async (ctx) => {
    const opened = await openRenderedDialogPage(ctx, '/pages/dialog-bare/index', '#dialog-bare-root')
    const collector = attachRuntimeErrorCollector(opened.miniProgram)

    try {
      await verifyDialogPageFlow(opened.page, collector, {
        openSelector: '#dialog-bare-open',
        title: 'issue-dialog-bare confirm title',
      })
      await verifyToastPageFlow(opened.page, collector, {
        toastSelector: '#dialog-bare-toast',
        message: 'issue-dialog-bare toast user-tap',
      })
    }
    finally {
      collector.dispose()
    }
  })

  it('keeps explicit /index dialog import callable in DevTools runtime', async (ctx) => {
    const opened = await openRenderedDialogPage(ctx, '/pages/dialog-index/index', '#dialog-index-root')
    const collector = attachRuntimeErrorCollector(opened.miniProgram)

    try {
      await verifyDialogPageFlow(opened.page, collector, {
        openSelector: '#dialog-index-open',
        title: 'issue-dialog-index confirm title',
      })
      await verifyToastPageFlow(opened.page, collector, {
        toastSelector: '#dialog-index-toast',
        message: 'issue-dialog-index toast user-tap',
      })
    }
    finally {
      collector.dispose()
    }
  })
})
