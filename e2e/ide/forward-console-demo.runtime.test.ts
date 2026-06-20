import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  launchAutomator,
  resolveProjectAutomatorPort,
  startForwardConsole,
} from 'weapp-ide-cli'
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
const DIST_INDEX_WXML = path.resolve(APP_ROOT, 'dist/pages/index/index.wxml')
const INDEX_ROUTE = '/pages/index/index'
const APP_AUTOMATOR_PORT = resolveProjectAutomatorPort(APP_ROOT)
const INITIAL_DESCRIPTION = '点击按钮，日志同步回当前终端。'
const DESCRIPTION_BINDING = '{{description}}'
const LOG_CLICKED_RE = /\[mini:log\s*\]\s+\[forward-console-demo\] Log clicked/
const LOG_CLICKED_MESSAGE_RE = /\[forward-console-demo\] Log clicked/

function resolveAutomatorSessionFile(projectPath: string, port?: number) {
  const normalizedProjectPath = path.resolve(projectPath)
  const sessionKey = port ? `${normalizedProjectPath}#port-${port}` : normalizedProjectPath
  const encodedProjectPath = Buffer.from(sessionKey).toString('base64url')
  return path.join(os.tmpdir(), 'weapp-vite-automator-sessions', `${encodedProjectPath}.json`)
}

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

function replaceTemplateDescription(source: string, nextDescription: string) {
  const updated = source.replace(DESCRIPTION_BINDING, nextDescription)
  if (updated === source) {
    throw new Error(`Expected ${INDEX_WXML} to contain the description binding`)
  }
  return updated
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
    await Promise.all([
      fs.rm(resolveAutomatorSessionFile(APP_ROOT), { force: true }).catch(() => {}),
    ])
  }, 60_000)

  afterEach(async () => {
    await cleanupTestState()
  }, 60_000)

  afterAll(async () => {
    await cleanupTestState()
  }, 60_000)

  it('keeps forwarding console output after dev HMR updates the current page', async () => {
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
      persistAsDefaultSession: true,
      preserveProjectRoot: true,
      projectPath: APP_ROOT,
      port: APP_AUTOMATOR_PORT,
      timeout: 60_000,
      trustProject: true,
    })
    const forwardedMessages: string[] = []
    forwardConsoleSession = await startForwardConsole({
      projectPath: APP_ROOT,
      port: APP_AUTOMATOR_PORT,
      logLevels: ['log', 'info', 'warn', 'error'],
      onLog(event) {
        forwardedMessages.push(`[mini:${event.level.padEnd(5)}] ${event.message}`)
      },
    })
    const page = await waitForPageDescription(miniProgram, INITIAL_DESCRIPTION)
    const logButton = await page.$('.action-log')

    expect(logButton).toBeTruthy()
    await logButton.tap()
    await waitForOutputAfter(() => forwardedMessages.join('\n'), 0, LOG_CLICKED_RE)

    const hmrDescription = `HMR forwardConsole ${Date.now()}`
    await fs.writeFile(INDEX_WXML, replaceTemplateDescription(originalIndexWxml, hmrDescription), 'utf8')
    await devProcess.waitFor(
      waitForFileContains(DIST_INDEX_WXML, hmrDescription, 90_000),
      'forward-console demo HMR dist update',
    )
    const updatedPage = await waitForPageDescription(miniProgram, hmrDescription, 90_000)
    const updatedLogButton = await updatedPage.$('.action-log')
    const outputBeforeHmrTap = forwardedMessages.join('\n').length

    expect(updatedLogButton).toBeTruthy()
    await updatedLogButton.tap()
    await waitForOutputAfter(() => forwardedMessages.join('\n'), outputBeforeHmrTap, LOG_CLICKED_MESSAGE_RE)
  }, 360_000)
})
