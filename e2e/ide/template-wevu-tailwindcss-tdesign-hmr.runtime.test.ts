import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { closeSharedMiniProgram } from '@weapp-vite/devtools-runtime'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveProjectAutomatorPort } from 'weapp-ide-cli'
import { launchAutomator } from '../utils/automator'
import {
  cleanupTrackedDevProcesses,
  startDevProcess,
} from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..')
const TEMPLATE_ROOT = path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-wevu-tailwindcss-tdesign-template')
const FIXTURE_PARENT = path.resolve(WORKSPACE_ROOT, '.tmp/e2e/ide-wevu-tailwind-hmr')
const INDEX_ROUTE = '/pages/index/index'
const PROBE_ID = 'wevu-tailwind-hmr-probe'
const STARTUP_ATTEMPTS = 1
const INITIAL_BACKGROUND_CLASS = 'bg-[#f6f7fb]'
const INITIAL_BACKGROUND_HEX = 'f6f7fb'
const BACKGROUND_UPDATES = [
  { action: 'modify', className: 'bg-[#dbeafe]', css: 'background-color: #dbeafe', escapedClass: 'bg-_b_hdbeafe_B', hex: 'dbeafe' },
  { action: 'delete', className: '', css: '', escapedClass: '', hex: 'none' },
  { action: 'add', className: 'bg-[#fef3c7]', css: 'background-color: #fef3c7', escapedClass: 'bg-_b_hfef3c7_B', hex: 'fef3c7' },
  { action: 'modify', className: 'bg-[#fce7f3]', css: 'background-color: #fce7f3', escapedClass: 'bg-_b_hfce7f3_B', hex: 'fce7f3' },
] as const
const FORBIDDEN_RUNTIME_ERRORS = [
  'unexpected current frame status timedout',
  'appLaunch with non-empty page stack',
  'Page route 错误',
] as const

function findRuntimeProbe(nodes: Array<{ dataset?: Record<string, unknown> }>, expectedHex: string) {
  return nodes.find(node => String(node.dataset?.e2eBg ?? '') === expectedHex)
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function resolveAutomatorSessionFile(projectPath: string, port?: number) {
  const normalizedProjectPath = path.resolve(projectPath)
  const sessionKey = port ? `${normalizedProjectPath}#port-${port}` : normalizedProjectPath
  const encodedProjectPath = Buffer.from(sessionKey).toString('base64url')
  return path.join(os.tmpdir(), 'weapp-vite-automator-sessions', `${encodedProjectPath}.json`)
}

function addRuntimeProbe(source: string) {
  const target = `<view class="min-h-screen ${INITIAL_BACKGROUND_CLASS}`
  if (!source.includes(target)) {
    throw new Error('Expected the template index page to contain the initial Tailwind background class')
  }
  return source.replace(
    target,
    `<view id="${PROBE_ID}" data-e2e-bg="${INITIAL_BACKGROUND_HEX}" class="min-h-screen ${INITIAL_BACKGROUND_CLASS}`,
  )
}

function updateRuntimeProbe(source: string, previousClass: string, nextClass: string, previousHex: string, nextHex: string) {
  const probeStartTag = new RegExp(`(<view id="${PROBE_ID}" data-e2e-bg=")${previousHex}(" class=")([^"]*)(")`)
  const match = source.match(probeStartTag)
  if (!match) {
    throw new Error(`Expected the runtime probe to use background marker ${previousHex}`)
  }
  const classes = match[3]!.split(/\s+/).filter(className => className && className !== previousClass)
  if (nextClass) {
    classes.push(nextClass)
  }
  return source.replace(probeStartTag, `$1${nextHex}$2${classes.join(' ')}$4`)
}

async function waitForFileMatch(file: string, matches: (source: string) => boolean, description: string, timeoutMs = 90_000) {
  const startedAt = Date.now()
  let latest = ''
  while (Date.now() - startedAt <= timeoutMs) {
    latest = await fs.readFile(file, 'utf8').catch(() => '')
    if (matches(latest)) {
      return latest
    }
    await delay(25)
  }
  throw new Error(`Timed out waiting for ${path.relative(WORKSPACE_ROOT, file)} to ${description}.\nLatest content:\n${latest.slice(0, 1000)}`)
}

async function waitForFileContains(file: string, expected: string, timeoutMs = 90_000) {
  return waitForFileMatch(file, source => source.includes(expected), `contain ${expected}`, timeoutMs)
}

describe.sequential('template wevu TailwindCSS TDesign HMR in real WeChat DevTools', () => {
  let appWxssDist = ''
  let appJsonDist = ''
  let currentVue = ''
  let devProcess: ReturnType<typeof startDevProcess> | undefined
  let distAppJs = ''
  let indexJsDist = ''
  let distWevuRuntimeJs = ''
  let fixtureRoot = ''
  let indexVue = ''
  let indexWxmlDist = ''
  let miniProgram: any

  async function removeAutomatorSessionFiles() {
    if (!fixtureRoot) {
      return
    }
    await Promise.all([
      fs.rm(resolveAutomatorSessionFile(fixtureRoot), { force: true }).catch(() => {}),
      fs.rm(resolveAutomatorSessionFile(fixtureRoot, resolveProjectAutomatorPort(fixtureRoot)), { force: true }).catch(() => {}),
    ])
  }

  async function stopDevSession() {
    if (miniProgram) {
      await Promise.resolve(miniProgram.disconnect?.()).catch(() => {})
      miniProgram = undefined
    }
    if (fixtureRoot) {
      await closeSharedMiniProgram(fixtureRoot).catch(() => {})
    }
    await devProcess?.stop().catch(() => {})
    devProcess = undefined
    await removeAutomatorSessionFiles()
    await cleanupResidualIdeProcesses()
  }

  async function waitForAppRuntimeReady(timeoutMs = 120_000) {
    const startedAt = Date.now()
    let latestApp = ''
    let latestAppJson = ''
    let latestPage = ''
    let latestRuntime = ''
    let latestWxml = ''
    let latestWxss = ''
    while (Date.now() - startedAt <= timeoutMs) {
      [latestApp, latestAppJson, latestPage, latestRuntime, latestWxml, latestWxss] = await Promise.all([
        fs.readFile(distAppJs, 'utf8').catch(() => ''),
        fs.readFile(appJsonDist, 'utf8').catch(() => ''),
        fs.readFile(indexJsDist, 'utf8').catch(() => ''),
        fs.readFile(distWevuRuntimeJs, 'utf8').catch(() => ''),
        fs.readFile(indexWxmlDist, 'utf8').catch(() => ''),
        fs.readFile(appWxssDist, 'utf8').catch(() => ''),
      ])
      if (
        latestApp.includes('require("./weapp-vendors/wevu-runtime.js")')
        && latestApp.includes('setWevuDefaults')
        && latestAppJson.includes('pages/index/index')
        && latestPage.includes('require("../../weapp-vendors/wevu-runtime.js")')
        && latestPage.includes('createWevuComponent')
        && latestPage.includes('module.exports = __wevuOptions')
        && latestRuntime.includes('Object.defineProperty(exports, "createApp"')
        && latestRuntime.includes('Object.defineProperty(exports, "setWevuDefaults"')
        && latestWxml.includes(PROBE_ID)
        && latestWxss.includes('background-color: #f6f7fb')
        && !latestApp.includes('from "wevu/internal-runtime"')
      ) {
        return { app: latestApp, runtime: latestRuntime }
      }
      await delay(500)
    }
    throw new Error(`Timed out waiting for the isolated fixture to emit a complete runnable output.\nLatest app:\n${latestApp.slice(0, 1000)}\nLatest app.json:\n${latestAppJson.slice(0, 1000)}\nLatest page:\n${latestPage.slice(0, 1000)}\nLatest runtime:\n${latestRuntime.slice(0, 1000)}\nLatest WXML:\n${latestWxml.slice(0, 1000)}\nLatest WXSS:\n${latestWxss.slice(0, 1000)}`)
  }

  async function waitForIndexPage(timeoutMs = 90_000) {
    const startedAt = Date.now()
    let latestRoute = ''
    while (Date.now() - startedAt <= timeoutMs) {
      const page = await miniProgram.currentPage({ retries: 1, timeout: 6_000 }).catch(() => null)
      latestRoute = page?.path ?? ''
      if (latestRoute === INDEX_ROUTE.slice(1)) {
        return page
      }
      await delay(500)
    }
    throw new Error(`Timed out waiting for ${INDEX_ROUTE}; latest route: ${latestRoute || '<none>'}`)
  }

  async function waitForRuntimeState(expectedHex: string, timeoutMs = 45_000) {
    const startedAt = Date.now()
    let latestNodes: unknown[] = []
    let latestError: unknown
    while (Date.now() - startedAt <= timeoutMs) {
      const page = await waitForIndexPage(8_000)
      try {
        const nodes = await page.renderedNodes(`#${PROBE_ID}`, {
          timeout: 6_000,
        })
        latestNodes = nodes
        if (findRuntimeProbe(nodes, expectedHex)) {
          return
        }
        latestError = undefined
      }
      catch (error) {
        latestError = error
      }
      try {
        const element = await page.$(`#${PROBE_ID}`, { timeout: 1_000 })
        const dataE2eBg = await element.attribute('data-e2e-bg')
        latestNodes = [{ dataset: { e2eBg: dataE2eBg } }]
        if (dataE2eBg === expectedHex) {
          return
        }
      }
      catch (error) {
        latestError = error
      }
      await delay(120)
    }
    const page = await waitForIndexPage(8_000)
    try {
      const nodes = await page.renderedNodes(`#${PROBE_ID}`, {
        timeout: 6_000,
      })
      latestNodes = nodes
      if (findRuntimeProbe(nodes, expectedHex)) {
        return
      }
    }
    catch (error) {
      latestError = error
    }
    const element = await page.$(`#${PROBE_ID}`, { timeout: 1_000 }).catch(() => null)
    const latestWxml = element ? await element.outerWxml().catch(() => '') : ''
    throw new Error(`Timed out waiting for the active DevTools page to render data-e2e-bg=${expectedHex}.\nLatest error:\n${String(latestError)}\nLatest WXML:\n${latestWxml.slice(0, 1000)}\nLatest rendered nodes:\n${JSON.stringify(latestNodes).slice(0, 1000)}`)
  }

  async function startDevSession() {
    let lastError: unknown
    for (let attempt = 1; attempt <= STARTUP_ATTEMPTS; attempt += 1) {
      await stopDevSession()
      await cleanDevtoolsCache('compile', { cwd: fixtureRoot })
      await removeAutomatorSessionFiles()
      await delay(1_600)
      devProcess = startDevProcess('pnpm', ['exec', 'wv', 'dev', '--non-interactive'], {
        cwd: fixtureRoot,
        env: createDevProcessEnv(),
        reject: false,
      })
      try {
        const initialRuntime = await devProcess.waitFor(
          waitForAppRuntimeReady(),
          `wevu Tailwind stateful HMR initial runtime attempt ${attempt}`,
        )
        miniProgram = await launchAutomator({
          deferBridgeWrapperSyncUntilConnected: true,
          engineBuildFallbackSettleMs: 5_000,
          launchMode: 'bridge',
          maxLaunchRetries: 1,
          projectPath: fixtureRoot,
          warmupAllowRelaunch: false,
          warmupRoute: INDEX_ROUTE,
          warmupRootSelectors: [`#${PROBE_ID}`],
        })
        await waitForIndexPage()
        await waitForFileContains(indexWxmlDist, PROBE_ID)
        await waitForRuntimeState(INITIAL_BACKGROUND_HEX)
        return initialRuntime
      }
      catch (error) {
        lastError = error
        process.stdout.write(`[warn] [template-wevu-tailwindcss-tdesign:hmr] restart initial session attempt=${attempt} reason=${error instanceof Error ? error.message : String(error)}\n`)
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }

  beforeAll(async () => {
    await cleanupResidualIdeProcesses()
    await fs.mkdir(FIXTURE_PARENT, { recursive: true })
    fixtureRoot = await fs.mkdtemp(path.join(FIXTURE_PARENT, 'fixture-'))
    await fs.cp(TEMPLATE_ROOT, fixtureRoot, {
      filter(source) {
        const relative = path.relative(TEMPLATE_ROOT, source)
        return relative !== 'dist'
          && !relative.startsWith(`dist${path.sep}`)
          && relative !== 'node_modules'
          && !relative.startsWith(`node_modules${path.sep}`)
          && relative !== '.weapp-vite'
          && !relative.startsWith(`.weapp-vite${path.sep}`)
      },
      recursive: true,
    })
    indexVue = path.join(fixtureRoot, 'src/pages/index/index.vue')
    const distRoot = path.join(fixtureRoot, 'dist')
    appJsonDist = path.join(distRoot, 'app.json')
    appWxssDist = path.join(distRoot, 'app.wxss')
    distAppJs = path.join(distRoot, 'app.js')
    distWevuRuntimeJs = path.join(distRoot, 'weapp-vendors/wevu-runtime.js')
    indexJsDist = path.join(distRoot, 'pages/index/index.js')
    indexWxmlDist = path.join(distRoot, 'pages/index/index.wxml')
    currentVue = addRuntimeProbe(await fs.readFile(indexVue, 'utf8'))
    await fs.writeFile(indexVue, currentVue, 'utf8')
    await removeAutomatorSessionFiles()
  }, 60_000)

  afterAll(async () => {
    await stopDevSession()
    await cleanupTrackedDevProcesses()
    if (fixtureRoot) {
      await fs.rm(fixtureRoot, { force: true, recursive: true }).catch(() => {})
    }
  }, 60_000)

  it('serializes consecutive arbitrary background updates without reloading the page stack', async () => {
    const initialRuntime = await startDevSession()

    const collector = attachRuntimeErrorCollector(miniProgram)
    const marker = collector.mark()
    let previousClass = INITIAL_BACKGROUND_CLASS
    let previousEscapedClass = 'bg-_b_hf6f7fb_B'
    let previousHex = INITIAL_BACKGROUND_HEX
    try {
      for (const update of BACKGROUND_UPDATES) {
        const nextVue = updateRuntimeProbe(
          currentVue,
          previousClass,
          update.className,
          previousHex,
          update.hex,
        )
        expect(nextVue).not.toBe(currentVue)
        const startedAt = Date.now()
        await fs.writeFile(indexVue, nextVue, 'utf8')
        currentVue = nextVue
        previousClass = update.className
        previousHex = update.hex

        const wxmlReady = waitForFileMatch(
          indexWxmlDist,
          source => update.escapedClass ? source.includes(update.escapedClass) : !source.includes(previousEscapedClass),
          update.escapedClass ? `contain ${update.escapedClass}` : 'remove the arbitrary background class',
        ).then(() => Date.now())
        const wxssReady = update.css
          ? waitForFileContains(appWxssDist, update.css).then(() => Date.now())
          : wxmlReady
        const runtimeReady = waitForRuntimeState(update.hex).then(() => Date.now())
        const [wxmlReadyAt, wxssReadyAt, runtimeReadyAt] = await Promise.all([
          wxmlReady,
          wxssReady,
          runtimeReady,
        ])
        const outputMs = Math.max(wxmlReadyAt, wxssReadyAt) - startedAt
        const runtimeMs = runtimeReadyAt - startedAt
        const devtoolsApplyMs = Math.max(0, runtimeReadyAt - Math.max(wxmlReadyAt, wxssReadyAt))
        process.stdout.write(`[template-wevu-tailwindcss-tdesign:hmr] update action=${update.action} class=${update.className || '<removed>'} wxmlMs=${wxmlReadyAt - startedAt} wxssMs=${wxssReadyAt - startedAt} outputMs=${outputMs} devtoolsApplyMs=${devtoolsApplyMs} runtimeMs=${runtimeMs}\n`)
        expect(outputMs).toBeLessThan(45_000)
        expect(runtimeMs).toBeLessThan(45_000)
        expect((await miniProgram.currentPage({ retries: 1, timeout: 6_000 }))?.path).toBe(INDEX_ROUTE.slice(1))
        previousEscapedClass = update.escapedClass
      }

      const runtimeErrors = collector.getSince(marker)
      expect(runtimeErrors).toEqual([])
      for (const forbidden of FORBIDDEN_RUNTIME_ERRORS) {
        expect(collector.getAllLogs().join('\n')).not.toContain(forbidden)
      }
      expect(initialRuntime.app).not.toContain('from "wevu/internal-runtime"')
      expect(initialRuntime.runtime).toContain('Object.defineProperty(exports, "setWevuDefaults"')
    }
    finally {
      collector.dispose()
    }
  }, 420_000)
})
