import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { closeSharedMiniProgram } from '@weapp-vite/devtools-runtime'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  connectOpenedAutomator,
  resolveProjectAutomatorPort,
} from 'weapp-ide-cli'
import { launchAutomator } from '../utils/automator'
import {
  cleanupTrackedDevProcesses,
  startDevProcess,
} from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..')
const TEMPLATE_ROOT = path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-wevu-tailwindcss-tdesign-template')
const INDEX_VUE = path.resolve(TEMPLATE_ROOT, 'src/pages/index/index.vue')
const DIST_ROOT = path.resolve(TEMPLATE_ROOT, 'dist')
const DIST_APP_JS = path.resolve(DIST_ROOT, 'app.js')
const DIST_WEVU_RUNTIME_JS = path.resolve(DIST_ROOT, 'weapp-vendors/wevu-runtime.js')
const INDEX_WXML_DIST = path.resolve(DIST_ROOT, 'pages/index/index.wxml')
const INDEX_ROUTE = '/pages/index/index'
const INITIAL_CARD_CLASS = 'rounded-[28rpx] bg-white p-[28rpx]'
const UPDATED_CARD_CLASS = 'rounded-[28rpx] bg-[red] p-[28rpx]'
const UPDATED_ESCAPED_CLASS = 'bg-_bred_B'

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function resolveAutomatorSessionFile(projectPath: string, port?: number) {
  const normalizedProjectPath = path.resolve(projectPath)
  const sessionKey = port ? `${normalizedProjectPath}#port-${port}` : normalizedProjectPath
  const encodedProjectPath = Buffer.from(sessionKey).toString('base64url')
  return path.join(os.tmpdir(), 'weapp-vite-automator-sessions', `${encodedProjectPath}.json`)
}

async function waitForOpenedAutomator(projectPath: string, timeoutMs = 120_000) {
  const start = Date.now()
  let lastError: unknown
  const port = resolveProjectAutomatorPort(projectPath)

  while (Date.now() - start <= timeoutMs) {
    try {
      return await connectOpenedAutomator({
        projectPath,
        port,
        timeout: 30_000,
      })
    }
    catch (error) {
      lastError = error
    }
    await delay(1_000)
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

function isDevtoolsProtocolTimeout(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }
  const protocolError = error as Error & { code?: unknown, method?: unknown }
  return protocolError.code === 'DEVTOOLS_PROTOCOL_TIMEOUT'
    && (protocolError.method === 'App.getCurrentPage' || protocolError.method === 'App.getPageStack')
}

async function waitForCurrentRoute(miniProgram: any, timeoutMs = 90_000) {
  const start = Date.now()
  let lastRoute = ''

  while (Date.now() - start <= timeoutMs) {
    try {
      const page = await miniProgram.currentPage({
        retries: 1,
        timeout: 6_000,
      })
      lastRoute = page?.path ?? ''
      if (lastRoute === INDEX_ROUTE.replace(/^\/+/, '')) {
        return page
      }
    }
    catch (error) {
      if (!isDevtoolsProtocolTimeout(error)) {
        throw error
      }
      miniProgram.disconnect?.()
      miniProgram = await waitForOpenedAutomator(TEMPLATE_ROOT, 30_000)
    }
    await delay(1_000)
  }

  throw new Error(`Timed out waiting for current route ${INDEX_ROUTE}; latest route: ${lastRoute || '<none>'}`)
}

async function waitForAppRuntimeReady(timeoutMs = 120_000) {
  const start = Date.now()
  let latestApp = ''
  let latestRuntime = ''

  while (Date.now() - start <= timeoutMs) {
    [latestApp, latestRuntime] = await Promise.all([
      fs.readFile(DIST_APP_JS, 'utf8').catch(() => ''),
      fs.readFile(DIST_WEVU_RUNTIME_JS, 'utf8').catch(() => ''),
    ])
    const hasStableRuntimeRequire = latestApp.includes('require("./weapp-vendors/wevu-runtime.js")')
    const hasRequiredRuntimeExports = latestRuntime.includes('Object.defineProperty(exports, "createApp"')
      && latestRuntime.includes('Object.defineProperty(exports, "setWevuDefaults"')
    if (
      latestApp.includes('createApp')
      && latestApp.includes('setWevuDefaults')
      && hasStableRuntimeRequire
      && hasRequiredRuntimeExports
      && !latestApp.includes('from "wevu/internal-runtime"')
    ) {
      return {
        app: latestApp,
        runtime: latestRuntime,
      }
    }
    await delay(500)
  }

  throw new Error([
    `Timed out waiting for ${path.relative(WORKSPACE_ROOT, DIST_APP_JS)} to use the stable wevu runtime.`,
    `Latest app content:\n${latestApp.slice(0, 1000)}`,
    `Latest runtime content:\n${latestRuntime.slice(0, 1000)}`,
  ].join('\n'))
}

async function waitForDistTailwindClass(timeoutMs = 90_000) {
  const start = Date.now()
  let latest = ''

  while (Date.now() - start <= timeoutMs) {
    latest = await fs.readFile(INDEX_WXML_DIST, 'utf8').catch(() => '')
    if (latest.includes(UPDATED_ESCAPED_CLASS)) {
      return latest
    }
    await delay(500)
  }

  throw new Error(`Timed out waiting for ${path.relative(WORKSPACE_ROOT, INDEX_WXML_DIST)} to contain ${UPDATED_ESCAPED_CLASS}.\nLatest content:\n${latest.slice(0, 1000)}`)
}

async function refreshRuntimeForDistUpdate(miniProgram: any) {
  await miniProgram.compile({ force: true }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    if (!/^unimplemented$/i.test(message.trim())) {
      throw error
    }
  })
  await delay(1_200)
  await miniProgram.reLaunch(INDEX_ROUTE)
  await delay(1_200)
}

describe.sequential('template wevu TailwindCSS TDesign HMR in real WeChat DevTools', () => {
  let restoreVue = ''
  let initialVue = ''
  let miniProgram: any
  let devProcess: ReturnType<typeof startDevProcess> | undefined

  async function removeAutomatorSessionFiles() {
    await Promise.all([
      fs.rm(resolveAutomatorSessionFile(TEMPLATE_ROOT), { force: true }).catch(() => {}),
      fs.rm(resolveAutomatorSessionFile(TEMPLATE_ROOT, resolveProjectAutomatorPort(TEMPLATE_ROOT)), { force: true }).catch(() => {}),
    ])
  }

  async function stopDevSession() {
    if (miniProgram) {
      await Promise.resolve(miniProgram.disconnect?.()).catch(() => {})
      miniProgram = undefined
    }
    await closeSharedMiniProgram(TEMPLATE_ROOT).catch(() => {})
    await devProcess?.stop().catch(() => {})
    devProcess = undefined
    await removeAutomatorSessionFiles()
    await cleanupResidualIdeProcesses()
  }

  async function startDevSession() {
    let lastError: unknown
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await stopDevSession()
      devProcess = startDevProcess('pnpm', ['exec', 'wv', 'dev', '--non-interactive'], {
        cwd: TEMPLATE_ROOT,
        env: createDevProcessEnv(),
        reject: false,
      })
      try {
        await devProcess.waitFor(
          waitForAppRuntimeReady(),
          `wevu tailwindcss tdesign initial dist app attempt ${attempt}`,
        )
        miniProgram = await launchAutomator({
          projectPath: TEMPLATE_ROOT,
          skipWarmup: true,
        })
        return miniProgram
      }
      catch (error) {
        lastError = error
        process.stdout.write(`[warn] [template-wevu-tailwindcss-tdesign:hmr] restart dev session attempt=${attempt} reason=${error instanceof Error ? error.message : String(error)}\n`)
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }

  beforeAll(async () => {
    restoreVue = await fs.readFile(INDEX_VUE, 'utf8')
    if (!restoreVue.includes(INITIAL_CARD_CLASS) && !restoreVue.includes(UPDATED_CARD_CLASS)) {
      throw new Error(`Expected ${INDEX_VUE} to contain the Tailwind HMR card class`)
    }
    initialVue = restoreVue.replace(UPDATED_CARD_CLASS, INITIAL_CARD_CLASS)
    if (initialVue !== restoreVue) {
      await fs.writeFile(INDEX_VUE, initialVue, 'utf8')
    }
    await fs.rm(DIST_ROOT, { force: true, recursive: true })
    await cleanupResidualIdeProcesses()
    await removeAutomatorSessionFiles()
  }, 60_000)

  afterAll(async () => {
    if (restoreVue) {
      await fs.writeFile(INDEX_VUE, restoreVue, 'utf8').catch(() => {})
    }
    await stopDevSession()
    await cleanupTrackedDevProcesses()
  }, 60_000)

  it('keeps wevu internal runtime bundled after bg-white changes to bg-[red]', async () => {
    await startDevSession()

    await waitForCurrentRoute(miniProgram)
    const collector = attachRuntimeErrorCollector(miniProgram)
    const marker = collector.mark()
    try {
      const updatedVue = initialVue.replace(INITIAL_CARD_CLASS, UPDATED_CARD_CLASS)
      expect(updatedVue).not.toBe(initialVue)
      await fs.writeFile(INDEX_VUE, updatedVue, 'utf8')
      await waitForDistTailwindClass()
      const runtimeOutput = await waitForAppRuntimeReady()
      await refreshRuntimeForDistUpdate(miniProgram)

      expect(await fs.readFile(INDEX_WXML_DIST, 'utf8')).toContain(UPDATED_ESCAPED_CLASS)
      expect(runtimeOutput.app).not.toContain('from "wevu/internal-runtime"')
      expect(runtimeOutput.runtime).toContain('Object.defineProperty(exports, "setWevuDefaults"')
      expect(collector.getSince(marker)).toEqual([])
    }
    finally {
      collector.dispose()
    }
  }, 420_000)
})
