import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { closeSharedMiniProgram } from '@weapp-vite/devtools-runtime'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectOpenedAutomator } from 'weapp-ide-cli'
import {
  cleanupTrackedDevProcesses,
  startDevProcess,
} from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..')
const TEMPLATE_ROOT = path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-tailwindcss-tdesign-template')
const INDEX_WXML = path.resolve(TEMPLATE_ROOT, 'src/pages/index/index.wxml')
const INDEX_ROUTE = '/pages/index/index'
const READY_OUTPUT_RE = /mini initial build completed|开发快捷键已就绪|✔ open/
const ROOT_MARKUP_RE = /<view class="min-h-screen \{\{ mode === 'light'\?'bg-\[#([0-9a-fA-F]{6})\] text-slate-800':'bg-gray-900 text-slate-200' \}\} transition-colors duration-500">/
const UPDATED_BACKGROUND_HEX = '10b981'
const UPDATED_BACKGROUND_RE = /^(?:rgb\(16,\s*185,\s*129\)|rgba\(16,\s*185,\s*129,\s*1\)|#10b981)$/i

interface AutomatorSessionMetadata {
  projectPath: string
  wsEndpoint: string
}

function resolveAutomatorSessionFile(projectPath: string) {
  const encodedProjectPath = Buffer.from(path.resolve(projectPath)).toString('base64url')
  return path.join(os.tmpdir(), 'weapp-vite-automator-sessions', `${encodedProjectPath}.json`)
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function createColorPattern(hex: string) {
  const normalized = hex.toLowerCase()
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  return new RegExp(`^(?:rgb\\(${red},\\s*${green},\\s*${blue}\\)|rgba\\(${red},\\s*${green},\\s*${blue},\\s*1\\)|#${normalized})$`, 'i')
}

async function waitForOpenedAutomator(projectPath: string, timeoutMs = 120_000) {
  const start = Date.now()
  let lastError: unknown

  while (Date.now() - start <= timeoutMs) {
    try {
      const raw = await fs.readFile(resolveAutomatorSessionFile(projectPath), 'utf8')
      const metadata = JSON.parse(raw) as Partial<AutomatorSessionMetadata>
      if (path.resolve(metadata.projectPath ?? '') !== projectPath) {
        throw new Error(`opened automator metadata project mismatch: ${JSON.stringify(metadata)}`)
      }
      if (typeof metadata.wsEndpoint !== 'string' || !/^ws:\/\/127\.0\.0\.1:\d+$/.test(metadata.wsEndpoint)) {
        throw new Error(`opened automator endpoint missing: ${JSON.stringify(metadata)}`)
      }
      return await connectOpenedAutomator({
        projectPath,
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

async function readRootBackgroundColor(miniProgram: any) {
  const page = await miniProgram.currentPage()
  const root = await page.$('#tailwind-hmr-probe')
  if (!root) {
    throw new Error('Failed to find Tailwind HMR probe')
  }
  return String(await root.style('background-color')).trim()
}

async function waitForRootBackgroundColor(
  miniProgram: any,
  pattern: RegExp,
  label: string,
  timeoutMs = 120_000,
) {
  const start = Date.now()
  let lastColor = ''
  while (Date.now() - start <= timeoutMs) {
    lastColor = await readRootBackgroundColor(miniProgram).catch(error => `ERROR:${error instanceof Error ? error.message : String(error)}`)
    if (pattern.test(lastColor)) {
      return lastColor
    }
    await delay(500)
  }
  throw new Error(`Timed out waiting for ${label}; last background-color=${lastColor}`)
}

describe.sequential('template TailwindCSS TDesign HMR in real WeChat DevTools', () => {
  let originalWxml = ''
  let originalBackgroundRe = /^$/
  let miniProgram: any
  let devProcess: ReturnType<typeof startDevProcess> | undefined

  beforeAll(async () => {
    originalWxml = await fs.readFile(INDEX_WXML, 'utf8')
    const rootMarkupMatch = originalWxml.match(ROOT_MARKUP_RE)
    if (!rootMarkupMatch) {
      throw new Error(`Expected ${INDEX_WXML} to contain the Tailwind HMR root markup`)
    }
    originalBackgroundRe = createColorPattern(rootMarkupMatch[1])
    await fs.rm(resolveAutomatorSessionFile(TEMPLATE_ROOT), { force: true }).catch(() => {})
  }, 60_000)

  afterAll(async () => {
    if (originalWxml) {
      await fs.writeFile(INDEX_WXML, originalWxml, 'utf8').catch(() => {})
    }
    if (miniProgram) {
      await miniProgram.disconnect?.()
      miniProgram = undefined
    }
    await closeSharedMiniProgram(TEMPLATE_ROOT).catch(() => {})
    await devProcess?.stop().catch(() => {})
    await cleanupTrackedDevProcesses()
  }, 60_000)

  it('updates the visible Tailwind arbitrary background color through dev HMR', async () => {
    devProcess = startDevProcess('pnpm', ['exec', 'wv', 'dev', '-o', '--non-interactive', '--login-retry', 'never'], {
      cwd: TEMPLATE_ROOT,
      env: createDevProcessEnv(),
      reject: false,
    })
    await devProcess.waitForOutput(READY_OUTPUT_RE, 'tailwindcss tdesign dev:open ready', 180_000)

    miniProgram = await waitForOpenedAutomator(TEMPLATE_ROOT)
    const rootMarkup = originalWxml.match(ROOT_MARKUP_RE)?.[0]
    if (!rootMarkup) {
      throw new Error(`Expected ${INDEX_WXML} to contain the Tailwind HMR root markup`)
    }

    const probedRootMarkup = rootMarkup.replace('<view ', '<view id="tailwind-hmr-probe" ')
    const patchedInitialWxml = originalWxml.replace(rootMarkup, probedRootMarkup)
    expect(patchedInitialWxml).not.toBe(originalWxml)
    await fs.writeFile(INDEX_WXML, patchedInitialWxml, 'utf8')
    await miniProgram.reLaunch(INDEX_ROUTE)
    await waitForRootBackgroundColor(miniProgram, originalBackgroundRe, 'initial Tailwind background')

    const updatedWxml = originalWxml.replace(
      rootMarkup,
      probedRootMarkup.replace(/bg-\[#([0-9a-fA-F]{6})\]/, `bg-[#${UPDATED_BACKGROUND_HEX}]`),
    )
    expect(updatedWxml).not.toBe(originalWxml)
    await fs.writeFile(INDEX_WXML, updatedWxml, 'utf8')

    await waitForRootBackgroundColor(miniProgram, UPDATED_BACKGROUND_RE, 'HMR Tailwind background')
  }, 420_000)
})
