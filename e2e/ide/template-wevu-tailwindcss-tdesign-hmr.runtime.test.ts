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
const INDEX_WXML_DIST = path.resolve(DIST_ROOT, 'pages/index/index.wxml')
const INDEX_ROUTE = '/pages/index/index'
const INITIAL_CARD_CLASS = 'rounded-[28rpx] bg-white p-[28rpx]'
const UPDATED_CARD_CLASS = 'rounded-[28rpx] bg-[red] p-[28rpx]'
const UPDATED_ESCAPED_CLASS = 'bg-_bred_B'
const CARD_PROBE_ID = 'wevu-tailwind-hmr-card'

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
  let latest = ''

  while (Date.now() - start <= timeoutMs) {
    latest = await fs.readFile(DIST_APP_JS, 'utf8').catch(() => '')
    const hasBundledRuntimeRequire = latest.includes('require("./common.js")')
      || latest.includes('require("./weapp-vendors/')
    if (
      latest.includes('createApp')
      && hasBundledRuntimeRequire
      && !latest.includes('from "wevu/internal-runtime"')
    ) {
      return latest
    }
    await delay(500)
  }

  throw new Error(`Timed out waiting for ${path.relative(WORKSPACE_ROOT, DIST_APP_JS)} to use bundled wevu runtime.\nLatest content:\n${latest.slice(0, 1000)}`)
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

function ensureCardProbe(source: string) {
  if (source.includes(`id="${CARD_PROBE_ID}"`)) {
    return source
  }
  const target = `<view class="${INITIAL_CARD_CLASS}`
  if (!source.includes(target)) {
    throw new Error(`Expected ${INDEX_VUE} to contain the HMR card markup`)
  }
  return source.replace(target, `<view id="${CARD_PROBE_ID}" class="${INITIAL_CARD_CLASS}`)
}

async function waitForRenderedCardClass(page: any, timeoutMs = 45_000) {
  const start = Date.now()
  let lastState: unknown

  while (Date.now() - start <= timeoutMs) {
    try {
      const element = await page.$(`#${CARD_PROBE_ID}`, { timeout: 3_000 }).catch(() => null)
      const [outerWxml, size] = element
        ? await Promise.all([
            element.outerWxml().catch(() => ''),
            element.size().catch(() => ({ height: 0, width: 0 })),
          ])
        : ['', { height: 0, width: 0 }]
      const rendered = element
        ? {}
        : await page.renderedSelectorNodes?.([`#${CARD_PROBE_ID}`], {
            timeout: 5_000,
          }).catch(() => ({}))
      const renderedNodes = rendered?.[`#${CARD_PROBE_ID}`] ?? []
      const renderedSized = renderedNodes.some((node: any) => Number(node?.width) > 0 && Number(node?.height) > 0)
      lastState = {
        outerWxml: String(outerWxml).slice(0, 500),
        renderedNodes,
        size,
      }
      if (
        (
          String(outerWxml).includes(UPDATED_ESCAPED_CLASS)
          && Number((size as any).width) > 0
          && Number((size as any).height) > 0
        )
        || renderedSized
      ) {
        return
      }
    }
    catch (error) {
      lastState = {
        error: error instanceof Error ? error.message : String(error),
      }
    }
    await delay(800)
  }

  throw new Error(`Timed out waiting rendered card class ${UPDATED_ESCAPED_CLASS}; lastState=${JSON.stringify(lastState)}`)
}

async function refreshRuntimeForDistUpdate(miniProgram: any) {
  await Promise.resolve(miniProgram?.compile?.({ force: true })).catch(() => {})
  await delay(1_200)
  return await miniProgram.reLaunch(INDEX_ROUTE).catch(async () => {
    return await waitForCurrentRoute(miniProgram)
  })
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
    initialVue = ensureCardProbe(restoreVue.replace(UPDATED_CARD_CLASS, INITIAL_CARD_CLASS))
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
    const collector = attachRuntimeErrorCollector(miniProgram)

    try {
      await waitForCurrentRoute(miniProgram)
      const marker = collector.mark()
      const updatedVue = initialVue.replace(INITIAL_CARD_CLASS, UPDATED_CARD_CLASS)
      expect(updatedVue).not.toBe(initialVue)
      await fs.writeFile(INDEX_VUE, updatedVue, 'utf8')
      await waitForDistTailwindClass()
      await waitForAppRuntimeReady()
      const page = await refreshRuntimeForDistUpdate(miniProgram)
      await waitForRenderedCardClass(page)

      const runtimeErrors = collector.getSince(marker)
      expect(runtimeErrors).not.toEqual(expect.arrayContaining([
        expect.stringContaining('wevu/internal-runtime'),
      ]))
      expect(await fs.readFile(DIST_APP_JS, 'utf8')).not.toContain('from "wevu/internal-runtime"')
    }
    finally {
      collector.dispose()
    }
  }, 420_000)
})
