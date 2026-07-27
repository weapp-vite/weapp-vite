/* eslint-disable e18e/ban-dependencies -- Web 项目矩阵需要 execa 管理逐项目 dev server。 */
import type { Subprocess } from 'execa'
import type { Browser, Page } from 'playwright'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { discoverWebProjects } from '../../scripts/web-project-matrix'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const CLI_PATH = fileURLToPath(new URL('../../packages/weapp-vite/dist/cli.mjs', import.meta.url))
const WEB_HOST = '127.0.0.1'
const WEB_PORT = Number(process.env.WEAPP_VITE_WEB_PROJECT_E2E_PORT ?? 5173)
const WEB_URL = `http://${WEB_HOST}:${WEB_PORT}`
const STARTUP_TIMEOUT = Number(process.env.WEAPP_VITE_WEB_PROJECT_STARTUP_TIMEOUT ?? 90_000)
const RUNTIME_TIMEOUT = Number(process.env.WEAPP_VITE_WEB_PROJECT_RUNTIME_TIMEOUT ?? 45_000)
const RUNTIME_STATE_ATTEMPTS = 3
const TRANSIENT_NAVIGATION_ERROR_RE = /Execution context was destroyed|Cannot find context with specified id|Inspected target navigated or closed/

const PLAYWRIGHT_EXECUTABLE = chromium.executablePath()
const CHROMIUM_CHANNEL = process.env.WEAPP_VITE_WEB_E2E_CHANNEL
const PLAYWRIGHT_BUNDLED_AVAILABLE = existsSync(PLAYWRIGHT_EXECUTABLE)
const BROWSER_AVAILABLE = PLAYWRIGHT_BUNDLED_AVAILABLE || Boolean(CHROMIUM_CHANNEL)
const describeWeb = BROWSER_AVAILABLE ? describe : describe.skip
const DEDICATED_WEB_PROJECTS = new Set([
  'e2e-apps/wot-ui-compat',
])
const MUTABLE_PROJECT_FILES: Readonly<Record<string, string[]>> = Object.freeze({
  'e2e-apps/request-clients-real': [
    'project.private.config.json',
    'src/shared/requestClientsRealDevBaseUrl.ts',
  ],
  'e2e-apps/request-clients-real-native': [
    'project.private.config.json',
    'src/shared/requestClientsRealDevBaseUrl.ts',
  ],
})

function createServerLogger(server: Subprocess) {
  const logs = { value: '' }
  server.stdout?.on('data', chunk => logs.value += String(chunk))
  server.stderr?.on('data', chunk => logs.value += String(chunk))
  return logs
}

async function stopServer(server: Subprocess | undefined, gracePeriod = 250) {
  if (!server || server.nodeChildProcess.exitCode !== null) {
    return
  }
  server.kill('SIGTERM')
  const timer = setTimeout(() => {
    if (server.nodeChildProcess.exitCode === null) {
      server.kill('SIGKILL')
    }
  }, gracePeriod)
  try {
    await server
  }
  catch {}
  finally {
    clearTimeout(timer)
  }
}

async function waitForServer(server: Subprocess, logs: { value: string }) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < STARTUP_TIMEOUT) {
    if (server.nodeChildProcess.exitCode !== null) {
      throw new Error(`Web dev server exited with ${server.nodeChildProcess.exitCode}.\n${logs.value}`)
    }
    try {
      const response = await fetch(WEB_URL)
      if (response.ok) {
        return
      }
    }
    catch {}
    await sleep(200)
  }
  throw new Error(`Timed out waiting for ${WEB_URL}.\n${logs.value}`)
}

async function readRuntimeState(page: Page) {
  let lastError: unknown
  for (let attempt = 0; attempt < RUNTIME_STATE_ATTEMPTS; attempt++) {
    try {
      return await page.evaluate(() => {
        const runtimeWindow = window as any
        const getCurrentPages = runtimeWindow.getCurrentPages
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
        const currentPage = pages.at(-1)
        return {
          hasWx: typeof runtimeWindow.wx === 'object',
          pageCount: document.querySelectorAll('[data-weapp-page]').length,
          route: typeof currentPage?.route === 'string' ? currentPage.route : null,
        }
      })
    }
    catch (error) {
      lastError = error
      if (!TRANSIENT_NAVIGATION_ERROR_RE.test(String(error))) {
        throw error
      }
      await page.waitForLoadState('domcontentloaded', { timeout: 5_000 })
    }
  }
  throw lastError
}

describeWeb.sequential('workspace Web project matrix', async () => {
  const projects = (await discoverWebProjects(ROOT))
    .filter(project => !DEDICATED_WEB_PROJECTS.has(project.relativeRoot))
  let browser: Browser | undefined
  let server: Subprocess | undefined

  beforeAll(async () => {
    const launchOptions = PLAYWRIGHT_BUNDLED_AVAILABLE || !CHROMIUM_CHANNEL
      ? { headless: true }
      : { headless: true, channel: CHROMIUM_CHANNEL as Parameters<typeof chromium.launch>[0]['channel'] }
    browser = await chromium.launch(launchOptions)
  })

  afterAll(async () => {
    await stopServer(server)
    await browser?.close()
  })

  for (const project of projects) {
    it(project.relativeRoot, async () => {
      const mutableSnapshots = await Promise.all(
        (MUTABLE_PROJECT_FILES[project.relativeRoot] ?? []).map(async (relativePath) => {
          const filename = path.join(project.root, relativePath)
          return { filename, source: await readFile(filename) }
        }),
      )
      const command = execa(process.execPath, [CLI_PATH, project.root, '--platform', 'web', '--host', WEB_HOST], {
        cwd: ROOT,
        env: {
          ...process.env,
          BROWSER: 'none',
        },
      })
      const completion = command.then(
        result => result,
        error => error,
      )
      server = command
      const logs = createServerLogger(command)

      try {
        if (project.expectation === 'startup-error') {
          const startup = await Promise.race([
            completion.then(result => ({ kind: 'exit' as const, result })),
            waitForServer(command, logs).then(() => ({ kind: 'server' as const })),
          ])
          if (startup.kind === 'exit') {
            expect(`${String(startup.result)}\n${logs.value}`).toMatch(/withDefaults|defineProps|编译|compile/i)
            return
          }

          const context = await browser!.newContext()
          const page = await context.newPage()
          const pageErrors: string[] = []
          page.on('pageerror', error => pageErrors.push(error.stack ?? error.message))
          try {
            await page.goto(WEB_URL, { waitUntil: 'domcontentloaded' })
            await expect.poll(
              () => `${logs.value}\n${pageErrors.join('\n')}`,
              { timeout: 15_000 },
            ).toMatch(/withDefaults|defineProps|编译|compile/i)
          }
          finally {
            await context.close()
          }
          return
        }

        await waitForServer(command, logs)
        const context = await browser!.newContext()
        const page = await context.newPage()
        const pageErrors: string[] = []
        page.on('pageerror', error => pageErrors.push(error.stack ?? error.message))
        try {
          await page.goto(WEB_URL, { waitUntil: 'domcontentloaded' })
          if (project.expectation === 'shell') {
            try {
              await expect.poll(async () => (await readRuntimeState(page)).hasWx, { timeout: RUNTIME_TIMEOUT })
                .toBe(true)
            }
            catch (error) {
              throw new Error(`${String(error)}\n${logs.value}\n${pageErrors.join('\n')}`)
            }
          }
          else {
            try {
              await expect.poll(async () => {
                const runtime = await readRuntimeState(page)
                return runtime.hasWx && runtime.pageCount > 0 && Boolean(runtime.route)
              }, { timeout: RUNTIME_TIMEOUT }).toBe(true)
            }
            catch (error) {
              throw new Error(`${String(error)}\n${logs.value}\n${pageErrors.join('\n')}`)
            }
          }
          const runtime = await readRuntimeState(page)
          if (project.expectation === 'shell') {
            expect(runtime.pageCount).toBe(0)
            expect(runtime.route).toBeNull()
          }
          else {
            expect(runtime.pageCount).toBeGreaterThan(0)
            expect(runtime.route).toBeTruthy()
          }
          expect(pageErrors).toEqual([])
        }
        finally {
          await context.close()
        }
      }
      finally {
        const gracePeriod = project.relativeRoot.startsWith('e2e-apps/request-clients-real')
          ? 5_000
          : 250
        await stopServer(command, gracePeriod)
        server = undefined
        for (const snapshot of mutableSnapshots) {
          expect(await readFile(snapshot.filename)).toEqual(snapshot.source)
        }
      }
    })
  }
})
