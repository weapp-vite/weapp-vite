import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { inflateSync } from 'node:zlib'
import { closeSharedMiniProgram } from '@weapp-vite/devtools-runtime'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveProjectAutomatorPort } from 'weapp-ide-cli'
import {
  cleanupTrackedDevProcesses,
  startDevProcess,
} from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { waitForOpenedAutomator } from '../utils/opened-automator'

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..')
const TEMPLATE_ROOT = path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-tailwindcss-tdesign-template')
const INDEX_WXML = path.resolve(TEMPLATE_ROOT, 'src/pages/index/index.wxml')
const INDEX_WXML_DIST = path.resolve(TEMPLATE_ROOT, 'dist/pages/index/index.wxml')
const INDEX_ROUTE = '/pages/index/index'
const ROOT_MARKUP_RE = /<view class="min-h-screen \{\{ mode === 'light'\?'[^']+':'bg-gray-900 text-slate-200' \}\} transition-colors duration-500">/
const LIGHT_BACKGROUND_CLASS_RE = /bg-(?:\[#([0-9a-fA-F]{6})\]|gray-100)/
const INITIAL_BACKGROUND_HEX = 'f3f4f6'
const UPDATED_BACKGROUND_HEX = '10b981'
const INITIAL_ESCAPED_CLASS = 'bg-_b_hf3f4f6_B'
const UPDATED_ESCAPED_CLASS = 'bg-_b_h10b981_B'
const PROBE_ID = 'tailwind-hmr-probe'
const CURRENT_PAGE_READ_TIMEOUT = 3_000
const CURRENT_PAGE_READ_RETRIES = 2
const ROUTE_READY_TIMEOUT = 30_000
const PNG_SIGNATURE = '89504e470d0a1a0a'
const SCREENSHOT_COLOR_MIN_MATCHED = 24
const SCREENSHOT_COLOR_MIN_RATIO = 0.01
const SCREENSHOT_CAPTURE_TIMEOUT = 30_000

function resolveAutomatorSessionFile(projectPath: string, port?: number) {
  const normalizedProjectPath = path.resolve(projectPath)
  const sessionKey = port ? `${normalizedProjectPath}#port-${port}` : normalizedProjectPath
  const encodedProjectPath = Buffer.from(sessionKey).toString('base64url')
  return path.join(os.tmpdir(), 'weapp-vite-automator-sessions', `${encodedProjectPath}.json`)
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runWithTimeout<T>(factory: () => Promise<T>, timeoutMs: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      factory(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Timeout in ${label} after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  }
  finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

function isDevtoolsPageProtocolUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('DevTools did not respond to protocol method App.getCurrentPage')
    || message.includes('DevTools did not respond to protocol method App.getPageStack')
    || message.includes('DevTools did not respond to protocol method App.callFunction')
    || message.includes('Operation timed out after')
    || message.includes('Connection closed, check if wechat web devTools is still running')
    || message.includes('WebSocket is not open')
    || message.includes('socket hang up')
    || message.includes('Target closed')
}

function normalizeCssColorToHex(value: unknown) {
  const text = String(value ?? '').trim().toLowerCase()
  const hexMatch = text.match(/^#([0-9a-f]{6})$/i)
  if (hexMatch) {
    return hexMatch[1]!.toLowerCase()
  }
  const rgbMatch = text.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (!rgbMatch) {
    return ''
  }
  return [rgbMatch[1], rgbMatch[2], rgbMatch[3]]
    .map(channel => Math.max(0, Math.min(255, Number(channel))).toString(16).padStart(2, '0'))
    .join('')
}

function replaceLightBackgroundClass(markup: string, hex: string) {
  const updated = markup.replace(LIGHT_BACKGROUND_CLASS_RE, `bg-[#${hex}]`)
  if (updated === markup) {
    throw new Error('Expected Tailwind HMR root markup to contain a replaceable light background class')
  }
  return updated
}

async function waitForIndexPage(miniProgram: any, timeoutMs = ROUTE_READY_TIMEOUT) {
  const start = Date.now()
  let lastError: unknown

  while (Date.now() - start <= timeoutMs) {
    try {
      const page = await miniProgram.currentPage({
        timeout: CURRENT_PAGE_READ_TIMEOUT,
        retries: CURRENT_PAGE_READ_RETRIES,
      })
      const currentPath = String(page?.path ?? '').replace(/^\/+/, '')
      if (currentPath === INDEX_ROUTE.replace(/^\/+/, '')) {
        return page
      }
    }
    catch (error) {
      lastError = error
      if (!isDevtoolsPageProtocolUnavailable(error)) {
        throw error
      }
    }
    await delay(300)
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Timed out waiting for ${INDEX_ROUTE}`)
}

async function relaunchIndexPage(miniProgram: any) {
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const page = await miniProgram.reLaunch(INDEX_ROUTE)
      return page || await waitForIndexPage(miniProgram)
    }
    catch (error) {
      lastError = error
      if (!isDevtoolsPageProtocolUnavailable(error)) {
        throw error
      }

      const currentPage = await waitForIndexPage(miniProgram, 5_000).catch(() => null)
      if (currentPage) {
        return currentPage
      }
      await delay(800)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to relaunch ${INDEX_ROUTE}`)
}

describe.sequential('template TailwindCSS TDesign HMR in real WeChat DevTools', () => {
  let originalWxml = ''
  let indexPage: any
  let miniProgram: any
  let devProcess: ReturnType<typeof startDevProcess> | undefined

  async function removeAutomatorSessionFiles() {
    await Promise.all([
      fs.rm(resolveAutomatorSessionFile(TEMPLATE_ROOT), { force: true }).catch(() => {}),
      fs.rm(resolveAutomatorSessionFile(TEMPLATE_ROOT, resolveProjectAutomatorPort(TEMPLATE_ROOT)), { force: true }).catch(() => {}),
    ])
  }

  beforeAll(async () => {
    originalWxml = await fs.readFile(INDEX_WXML, 'utf8')
    const rootMarkupMatch = originalWxml.match(ROOT_MARKUP_RE)
    if (!rootMarkupMatch) {
      throw new Error(`Expected ${INDEX_WXML} to contain the Tailwind HMR root markup`)
    }
    await closeSharedMiniProgram(TEMPLATE_ROOT).catch(() => {})
    await removeAutomatorSessionFiles()
    await cleanupResidualIdeProcesses()
  }, 60_000)

  async function stopDevSession() {
    if (miniProgram) {
      await Promise.resolve(miniProgram.disconnect?.()).catch(() => {})
      miniProgram = undefined
    }
    indexPage = undefined
    await closeSharedMiniProgram(TEMPLATE_ROOT).catch(() => {})
    await devProcess?.stop().catch(() => {})
    devProcess = undefined
    await removeAutomatorSessionFiles()
    await cleanupResidualIdeProcesses()
  }

  afterAll(async () => {
    if (originalWxml) {
      await fs.writeFile(INDEX_WXML, originalWxml, 'utf8').catch(() => {})
    }
    await stopDevSession()
    await cleanupTrackedDevProcesses()
  }, 60_000)

  async function startDevSession() {
    process.stdout.write('[template-tailwindcss-tdesign:hmr] start-dev-session\n')
    devProcess = startDevProcess('pnpm', ['exec', 'wv', 'dev', '-o', '--non-interactive', '--login-retry', 'never'], {
      cwd: TEMPLATE_ROOT,
      env: createDevProcessEnv(),
      reject: false,
    })
    process.stdout.write(`[template-tailwindcss-tdesign:hmr] dev-process-started pid=${devProcess.pid ?? 'unknown'}\n`)
    const session = await devProcess.waitFor(
      waitForOpenedAutomator(TEMPLATE_ROOT, { timeoutMs: 120_000 }),
      'tailwindcss tdesign dev:open ready',
    )
    miniProgram = session.miniProgram
    process.stdout.write(`[template-tailwindcss-tdesign:hmr] automator-connected endpoint=${session.metadata.wsEndpoint}\n`)
    return miniProgram
  }

  async function refreshRuntimeForDistUpdate(label: string) {
    process.stdout.write(`[template-tailwindcss-tdesign:hmr] refresh-runtime label=${label}\n`)
    await Promise.resolve(miniProgram?.compile?.({ force: true })).catch(() => {})
    await delay(1_200)
    indexPage = await relaunchIndexPage(miniProgram)
  }

  function paethPredictor(left: number, up: number, upLeft: number) {
    const estimate = left + up - upLeft
    const leftDistance = Math.abs(estimate - left)
    const upDistance = Math.abs(estimate - up)
    const upLeftDistance = Math.abs(estimate - upLeft)
    if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
      return left
    }
    return upDistance <= upLeftDistance ? up : upLeft
  }

  function analyzeScreenshotColor(base64: string, hex: string) {
    const target = [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ]
    const buffer = Buffer.from(base64, 'base64')
    if (buffer.subarray(0, 8).toString('hex') !== PNG_SIGNATURE) {
      throw new Error('Screenshot is not a PNG image')
    }

    let offset = 8
    let width = 0
    let height = 0
    let colorType = 0
    const idatChunks: Buffer[] = []

    while (offset + 8 <= buffer.length) {
      const length = buffer.readUInt32BE(offset)
      const type = buffer.subarray(offset + 4, offset + 8).toString('ascii')
      const dataStart = offset + 8
      const dataEnd = dataStart + length
      const data = buffer.subarray(dataStart, dataEnd)
      if (type === 'IHDR') {
        width = data.readUInt32BE(0)
        height = data.readUInt32BE(4)
        colorType = data[9] ?? 0
      }
      else if (type === 'IDAT') {
        idatChunks.push(data)
      }
      else if (type === 'IEND') {
        break
      }
      offset = dataEnd + 4
    }

    const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0
    if (!width || !height || !channels) {
      throw new Error(`Unsupported screenshot PNG format: width=${width} height=${height} colorType=${colorType}`)
    }

    const inflated = inflateSync(Buffer.concat(idatChunks))
    const rowLength = width * channels
    const previous = Buffer.alloc(rowLength)
    const current = Buffer.alloc(rowLength)
    let sourceOffset = 0
    let samples = 0
    let matched = 0
    const tolerance = 48

    for (let y = 0; y < height; y += 1) {
      const filter = inflated[sourceOffset]
      sourceOffset += 1
      inflated.copy(current, 0, sourceOffset, sourceOffset + rowLength)
      sourceOffset += rowLength
      for (let index = 0; index < rowLength; index += 1) {
        const left = index >= channels ? current[index - channels]! : 0
        const up = previous[index] ?? 0
        const upLeft = index >= channels ? previous[index - channels]! : 0
        if (filter === 1) {
          current[index] = (current[index]! + left) & 0xFF
        }
        else if (filter === 2) {
          current[index] = (current[index]! + up) & 0xFF
        }
        else if (filter === 3) {
          current[index] = (current[index]! + Math.floor((left + up) / 2)) & 0xFF
        }
        else if (filter === 4) {
          current[index] = (current[index]! + paethPredictor(left, up, upLeft)) & 0xFF
        }
      }
      if (y > Math.floor(height * 0.12) && y % 8 === 0) {
        for (let x = 0; x < width; x += 8) {
          const index = x * channels
          const red = current[index] ?? 0
          const green = channels === 1 ? red : current[index + 1] ?? 0
          const blue = channels === 1 ? red : current[index + 2] ?? 0
          samples += 1
          if (
            Math.abs(red - target[0]!) <= tolerance
            && Math.abs(green - target[1]!) <= tolerance
            && Math.abs(blue - target[2]!) <= tolerance
          ) {
            matched += 1
          }
        }
      }
      current.copy(previous)
    }

    return {
      height,
      matched,
      ratio: samples > 0 ? matched / samples : 0,
      samples,
      width,
    }
  }

  async function waitForScreenshotColor(expectedBg: string, label: string, timeoutMs = 30_000) {
    const start = Date.now()
    let lastAnalysis: unknown
    while (Date.now() - start <= timeoutMs) {
      try {
        const screenshot = await miniProgram.screenshot({ timeout: SCREENSHOT_CAPTURE_TIMEOUT })
        lastAnalysis = analyzeScreenshotColor(screenshot, expectedBg)
      }
      catch (error) {
        lastAnalysis = {
          error: error instanceof Error ? error.message : String(error),
        }
      }
      if (
        (lastAnalysis as any).matched >= SCREENSHOT_COLOR_MIN_MATCHED
        && (lastAnalysis as any).ratio >= SCREENSHOT_COLOR_MIN_RATIO
      ) {
        return lastAnalysis
      }
      await delay(800)
    }
    throw new Error(`Timed out waiting for ${label}; lastAnalysis=${JSON.stringify(lastAnalysis)}`)
  }

  async function readProbeBackgroundState(expectedBg: string, escapedClass: string) {
    const page = indexPage ?? await relaunchIndexPage(miniProgram)
    const selector = `#${PROBE_ID}`
    const element = await runWithTimeout(() => page.$(selector, { timeout: 3_000 }), 5_000, 'query Tailwind HMR probe').catch(() => null)
    const [backgroundColor, outerWxml, size] = element
      ? await Promise.all([
          runWithTimeout(() => element.style('background-color'), 5_000, 'read Tailwind HMR probe background').catch(error => `__error__:${error instanceof Error ? error.message : String(error)}`),
          runWithTimeout(() => element.outerWxml(), 5_000, 'read Tailwind HMR probe wxml').catch(() => ''),
          runWithTimeout(() => element.size(), 5_000, 'read Tailwind HMR probe size').catch(() => ({ height: 0, width: 0 })),
        ])
      : ['', '', { height: 0, width: 0 }]
    let nodeCount = element ? 1 : 0
    let sized = Number((size as any).width) > 0 && Number((size as any).height) > 0
    if (!element) {
      const rendered = await page.renderedSelectorNodes([selector], {
        timeout: 5_000,
      }).catch(() => ({}))
      const nodes = rendered[selector] ?? []
      nodeCount = nodes.length
      sized = nodes.some((node: any) => Number(node?.width) > 0 && Number(node?.height) > 0)
    }
    const backgroundHex = normalizeCssColorToHex(backgroundColor)
    return {
      backgroundColor,
      backgroundHex,
      classMatched: outerWxml.includes(escapedClass) || outerWxml.includes(`bg-[#${expectedBg}]`),
      dataMatched: outerWxml.includes(`data-e2e-bg="${expectedBg}"`),
      nodeCount,
      outerWxml: outerWxml.slice(0, 500),
      sized,
    }
  }

  async function waitForProbeBackgroundColor(expectedBg: string, escapedClass: string, label: string, timeoutMs = 45_000) {
    const start = Date.now()
    let lastState: unknown
    while (Date.now() - start <= timeoutMs) {
      try {
        lastState = await readProbeBackgroundState(expectedBg, escapedClass)
        const state = lastState as Awaited<ReturnType<typeof readProbeBackgroundState>>
        if (state.sized && (state.backgroundHex === expectedBg || (state.dataMatched && state.classMatched))) {
          return state
        }
      }
      catch (error) {
        lastState = {
          error: error instanceof Error ? error.message : String(error),
        }
      }
      await delay(800)
    }
    throw new Error(`Timed out waiting DOM probe for ${label}; lastState=${JSON.stringify(lastState)}`)
  }

  async function waitForVisibleBackgroundWithRecovery(expectedBg: string, escapedClass: string, label: string) {
    await refreshRuntimeForDistUpdate(label)
    try {
      return await waitForProbeBackgroundColor(expectedBg, escapedClass, label, 45_000)
    }
    catch (error) {
      const probeMessage = error instanceof Error ? error.message : String(error)
      process.stdout.write(`[template-tailwindcss-tdesign:hmr] dom-probe-fallback-screenshot label=${label} reason=${probeMessage}\n`)
      try {
        return await waitForScreenshotColor(expectedBg, label, 45_000)
      }
      catch {
      }
      const message = error instanceof Error ? error.message : String(error)
      process.stdout.write(`[template-tailwindcss-tdesign:hmr] restart-dev-session label=${label} reason=${message}\n`)
      await stopDevSession()
      await delay(1_200)
      await startDevSession()
      indexPage = await relaunchIndexPage(miniProgram)
      try {
        return await waitForProbeBackgroundColor(expectedBg, escapedClass, label, 30_000)
      }
      catch {
        return await waitForScreenshotColor(expectedBg, label, 30_000)
      }
    }
  }

  it('updates the visible Tailwind arbitrary background color through dev HMR', async () => {
    await startDevSession()
    const rootMarkup = originalWxml.match(ROOT_MARKUP_RE)?.[0]
    if (!rootMarkup) {
      throw new Error(`Expected ${INDEX_WXML} to contain the Tailwind HMR root markup`)
    }

    const probedRootMarkup = replaceLightBackgroundClass(
      rootMarkup.replace('<view ', `<view id="${PROBE_ID}" data-e2e-bg="${INITIAL_BACKGROUND_HEX}" `),
      INITIAL_BACKGROUND_HEX,
    )
    const patchedInitialWxml = originalWxml.replace(rootMarkup, probedRootMarkup)
    expect(patchedInitialWxml).not.toBe(originalWxml)
    await replaceFileByRename(INDEX_WXML, patchedInitialWxml)
    await waitForFileContains(INDEX_WXML_DIST, PROBE_ID)
    await waitForFileContains(INDEX_WXML_DIST, `data-e2e-bg="${INITIAL_BACKGROUND_HEX}"`)
    await waitForFileContains(INDEX_WXML_DIST, INITIAL_ESCAPED_CLASS)
    await waitForVisibleBackgroundWithRecovery(INITIAL_BACKGROUND_HEX, INITIAL_ESCAPED_CLASS, 'initial Tailwind background')

    const updatedWxml = originalWxml.replace(
      rootMarkup,
      replaceLightBackgroundClass(
        probedRootMarkup.replace(`data-e2e-bg="${INITIAL_BACKGROUND_HEX}"`, `data-e2e-bg="${UPDATED_BACKGROUND_HEX}"`),
        UPDATED_BACKGROUND_HEX,
      ),
    )
    expect(updatedWxml).not.toBe(originalWxml)
    await replaceFileByRename(INDEX_WXML, updatedWxml)
    await waitForFileContains(INDEX_WXML_DIST, `data-e2e-bg="${UPDATED_BACKGROUND_HEX}"`)
    await waitForFileContains(INDEX_WXML_DIST, UPDATED_ESCAPED_CLASS)
    await waitForVisibleBackgroundWithRecovery(UPDATED_BACKGROUND_HEX, UPDATED_ESCAPED_CLASS, 'updated Tailwind background')
  }, 420_000)
})
