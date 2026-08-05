import fs from 'node:fs/promises'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest'
import {
  resolveProjectAutomatorPort,
  startForwardConsole,
} from 'weapp-ide-cli'
import { launchAutomator } from '../utils/automator'
import {
  cleanupTrackedDevProcesses,
  startDevProcess,
} from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { waitForFileContains } from '../utils/hmr-helpers'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..')
const APP_ROOT = path.resolve(WORKSPACE_ROOT, 'apps/forward-console-demo')
const INDEX_TS = path.resolve(APP_ROOT, 'src/pages/index/index.ts')
const INDEX_WXML = path.resolve(APP_ROOT, 'src/pages/index/index.wxml')
const DIST_INDEX_JS = path.resolve(APP_ROOT, 'dist/pages/index/index.js')
const HMR_UPDATE_JS = path.resolve(APP_ROOT, 'dist/__weapp_vite_hmr/update.js')
const INDEX_ROUTE = '/pages/index/index'
const APP_AUTOMATOR_PORT = resolveProjectAutomatorPort(APP_ROOT)
const INITIAL_DESCRIPTION = '点击按钮，日志同步回当前终端。'
const INITIAL_LOG_MESSAGE = ['`[forward-console-demo] $', '{action.title} clicked`'].join('')
const LOG_CLICKED_RE = /\[mini:log\s*\]\s+\[forward-console-demo\] Log clicked/

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForOutputAfter(
  getOutput: () => string,
  since: number,
  matcher: RegExp,
  timeoutMs = 30_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const nextOutput = getOutput().slice(since)
    if (matcher.test(nextOutput)) {
      return
    }
    await delay(200)
  }
  throw new Error(`Timed out waiting for output; recent output=${getOutput().slice(since)}`)
}

async function waitForIndexPage(miniProgram: any, timeoutMs = 30_000) {
  const start = Date.now()
  let lastPath = ''
  while (Date.now() - start < timeoutMs) {
    const page = await miniProgram.currentPage().catch(() => null)
    lastPath = String(page?.path ?? '')
    if (page && lastPath.replace(/^\/+/, '') === INDEX_ROUTE.replace(/^\/+/, '')) {
      return page
    }
    await delay(300)
  }
  throw new Error(`Timed out waiting for ${INDEX_ROUTE}; lastPath=${lastPath}`)
}

async function waitForPageDescription(miniProgram: any, expected: string, timeoutMs = 60_000) {
  const start = Date.now()
  let lastValue: unknown
  let lastText = ''
  while (Date.now() - start < timeoutMs) {
    const page = await waitForIndexPage(miniProgram, 5_000).catch(() => null)
    if (page) {
      lastValue = await page.data('description').catch((error: unknown) => {
        return error instanceof Error ? error.message : String(error)
      })
      if (lastValue === expected) {
        return page
      }
      const description = await page.$('.description').catch(() => null)
      lastText = description ? String(await description.text().catch(() => '')) : ''
      if (lastText.trim() === expected) {
        return page
      }
      await page.waitFor(300).catch(() => delay(300))
    }
    else {
      await delay(300)
    }
  }
  throw new Error(`Timed out waiting for page description "${expected}"; lastValue=${String(lastValue)}; lastText=${lastText}`)
}

async function emitLogClick(miniProgram: any) {
  await miniProgram.evaluate(() => {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    const page = pages[pages.length - 1]
    if (!page || typeof page.onEmitLog !== 'function') {
      throw new Error('Current page does not expose onEmitLog')
    }
    return page.onEmitLog({
      currentTarget: {
        dataset: {
          level: 'log',
        },
      },
    })
  })
}

function replaceSourceLogMessage(source: string, nextMessage: string) {
  const updated = source.replace(INITIAL_LOG_MESSAGE, JSON.stringify(nextMessage))
  if (updated === source) {
    throw new Error(`Expected ${INDEX_TS} to contain the initial log message`)
  }
  return updated
}

async function waitForForwardedMessage(
  miniProgram: any,
  getOutput: () => string,
  matcher: RegExp,
  timeoutMs = 30_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const since = getOutput().length
    await emitLogClick(miniProgram)
    try {
      await waitForOutputAfter(getOutput, since, matcher, 2_000)
      return
    }
    catch {
      await delay(300)
    }
  }
  throw new Error(`Timed out waiting for forwarded HMR message; recent output=${getOutput()}`)
}

describe.sequential('forward-console-demo in real WeChat DevTools', () => {
  let originalIndexTs = ''
  let originalIndexWxml = ''
  let devProcess: ReturnType<typeof startDevProcess> | undefined
  let forwardConsoleSession: Awaited<ReturnType<typeof startForwardConsole>> | undefined
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined

  async function cleanupTestState() {
    if (originalIndexTs) {
      await fs.writeFile(INDEX_TS, originalIndexTs, 'utf8').catch(() => {})
    }
    if (originalIndexWxml) {
      await fs.writeFile(INDEX_WXML, originalIndexWxml, 'utf8').catch(() => {})
    }
    await forwardConsoleSession?.close().catch(() => {})
    forwardConsoleSession = undefined
    miniProgram?.disconnect?.()
    miniProgram = undefined
    await devProcess?.stop().catch(() => {})
    devProcess = undefined
    await cleanupTrackedDevProcesses()
    await cleanupResidualIdeProcesses()
  }

  beforeAll(async () => {
    const [indexTs, indexWxml] = await Promise.all([
      fs.readFile(INDEX_TS, 'utf8'),
      fs.readFile(INDEX_WXML, 'utf8'),
    ])
    originalIndexTs = indexTs
    originalIndexWxml = indexWxml
    await cleanupResidualIdeProcesses()
    devProcess = startDevProcess('pnpm', ['exec', 'wv', 'dev'], {
      cwd: APP_ROOT,
      env: createDevProcessEnv(),
      reject: false,
      stdin: 'ignore',
    })
    await devProcess.waitFor(
      waitForFileContains(DIST_INDEX_JS, INITIAL_DESCRIPTION, 90_000),
      'forward-console demo initial dist generated',
    )
    miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      port: APP_AUTOMATOR_PORT,
      retryWarmupTimeout: true,
      timeout: 120_000,
      trustProject: true,
    })
  }, 240_000)

  afterEach(async () => {
    if (originalIndexTs) {
      await fs.writeFile(INDEX_TS, originalIndexTs, 'utf8').catch(() => {})
    }
    if (originalIndexWxml) {
      await fs.writeFile(INDEX_WXML, originalIndexWxml, 'utf8').catch(() => {})
    }
    await forwardConsoleSession?.close().catch(() => {})
    forwardConsoleSession = undefined
    await devProcess?.stop().catch(() => {})
    devProcess = undefined
    await cleanupTrackedDevProcesses()
  }, 60_000)

  afterAll(async () => {
    await cleanupTestState()
  }, 60_000)

  it('keeps forwarding console output after dev HMR updates the current page', async () => {
    if (!miniProgram) {
      throw new Error('Shared automator session is not initialized')
    }
    await waitForPageDescription(miniProgram, INITIAL_DESCRIPTION)
    const forwardedMessages: string[] = []
    forwardConsoleSession = await startForwardConsole({
      miniProgram,
      projectPath: APP_ROOT,
      port: APP_AUTOMATOR_PORT,
      logLevels: ['log', 'info', 'warn', 'error'],
      onLog(event) {
        forwardedMessages.push(`[mini:${event.level.padEnd(5)}] ${event.message}`)
      },
    })

    await emitLogClick(miniProgram)
    await waitForOutputAfter(() => forwardedMessages.join('\n'), 0, LOG_CLICKED_RE)

    const hmrMessage = `HMR forwardConsole ${Date.now()}`
    await fs.writeFile(INDEX_TS, replaceSourceLogMessage(originalIndexTs, hmrMessage), 'utf8')
    await devProcess.waitFor(
      waitForFileContains(HMR_UPDATE_JS, hmrMessage, 90_000),
      'forward-console demo stateful HMR delta update',
    )
    await waitForForwardedMessage(
      miniProgram,
      () => forwardedMessages.join('\n'),
      new RegExp(hmrMessage),
      90_000,
    )
  }, 360_000)
})
