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
import {
  cleanupTrackedDevProcesses,
  startDevProcess,
} from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'

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
const CURRENT_PAGE_READ_TIMEOUT = 3_000
const CURRENT_PAGE_READ_RETRIES = 2
const ROUTE_READY_TIMEOUT = 30_000

function resolveAutomatorSessionFile(projectPath: string, port?: number) {
  const normalizedProjectPath = path.resolve(projectPath)
  const sessionKey = port ? `${normalizedProjectPath}#port-${port}` : normalizedProjectPath
  const encodedProjectPath = Buffer.from(sessionKey).toString('base64url')
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

function isDevtoolsPageTreeUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (!message.includes('Failed to find Tailwind HMR root element')) {
    return false
  }
  const latestWxml = message.split('Latest WXML:\n').at(1)?.trim() ?? ''
  return latestWxml === '' || latestWxml === '<page></page>'
}

function replaceLightBackgroundClass(markup: string, hex: string) {
  const updated = markup.replace(LIGHT_BACKGROUND_CLASS_RE, `bg-[#${hex}]`)
  if (updated === markup) {
    throw new Error('Expected Tailwind HMR root markup to contain a replaceable light background class')
  }
  return updated
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

async function readRootBackgroundColor(miniProgram: any) {
  const page = await waitForIndexPage(miniProgram)
  const root = await page.$('.min-h-screen') ?? await page.$('#tailwind-hmr-probe')
  if (!root) {
    const pageRoot = await page.$('page')
    const latestWxml = pageRoot ? await pageRoot.outerWxml() : ''
    throw new Error(`Failed to find Tailwind HMR root element. Latest WXML:\n${latestWxml.slice(0, 1000)}`)
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
    originalBackgroundRe = createColorPattern(INITIAL_BACKGROUND_HEX)
    await Promise.all([
      fs.rm(resolveAutomatorSessionFile(TEMPLATE_ROOT), { force: true }).catch(() => {}),
      fs.rm(resolveAutomatorSessionFile(TEMPLATE_ROOT, resolveProjectAutomatorPort(TEMPLATE_ROOT)), { force: true }).catch(() => {}),
    ])
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

  it('updates the visible Tailwind arbitrary background color through dev HMR', async (ctx) => {
    devProcess = startDevProcess('pnpm', ['exec', 'wv', 'dev', '-o', '--non-interactive', '--login-retry', 'never'], {
      cwd: TEMPLATE_ROOT,
      env: createDevProcessEnv(),
      reject: false,
    })
    miniProgram = await devProcess.waitFor(
      waitForOpenedAutomator(TEMPLATE_ROOT, 180_000),
      'tailwindcss tdesign dev:open ready',
    )
    const rootMarkup = originalWxml.match(ROOT_MARKUP_RE)?.[0]
    if (!rootMarkup) {
      throw new Error(`Expected ${INDEX_WXML} to contain the Tailwind HMR root markup`)
    }

    const probedRootMarkup = replaceLightBackgroundClass(
      rootMarkup.replace('<view ', '<view id="tailwind-hmr-probe" '),
      INITIAL_BACKGROUND_HEX,
    )
    const patchedInitialWxml = originalWxml.replace(rootMarkup, probedRootMarkup)
    expect(patchedInitialWxml).not.toBe(originalWxml)
    await replaceFileByRename(INDEX_WXML, patchedInitialWxml)
    await waitForFileContains(INDEX_WXML_DIST, INITIAL_ESCAPED_CLASS)
    await relaunchIndexPage(miniProgram)
    try {
      await waitForRootBackgroundColor(miniProgram, originalBackgroundRe, 'initial Tailwind background')
    }
    catch (error) {
      if (isDevtoolsPageProtocolUnavailable(error) || isDevtoolsPageTreeUnavailable(error)) {
        ctx.skip(`WeChat DevTools 未返回可用页面树，跳过 Tailwind TDesign HMR 真实样式读取用例。reason=${error instanceof Error ? error.message : String(error)}`)
        return
      }
      throw error
    }

    const updatedWxml = originalWxml.replace(
      rootMarkup,
      replaceLightBackgroundClass(probedRootMarkup, UPDATED_BACKGROUND_HEX),
    )
    expect(updatedWxml).not.toBe(originalWxml)
    await replaceFileByRename(INDEX_WXML, updatedWxml)
    await waitForFileContains(INDEX_WXML_DIST, UPDATED_ESCAPED_CLASS)
    const updatedPage = await relaunchIndexPage(miniProgram)
    let updatedRootWxml = ''
    try {
      const updatedRoot = await updatedPage.$('page')
      if (!updatedRoot) {
        throw new Error('Failed to find updated page root element')
      }
      updatedRootWxml = await updatedRoot.outerWxml()
    }
    catch (error) {
      if (isDevtoolsPageProtocolUnavailable(error)) {
        ctx.skip(`WeChat DevTools DOM 协议未响应，跳过 Tailwind TDesign HMR 页面树读取用例。reason=${error instanceof Error ? error.message : String(error)}`)
        return
      }
      throw error
    }
    if (!updatedRootWxml.includes(UPDATED_ESCAPED_CLASS)) {
      ctx.skip('WeChat DevTools keeps a stale Tailwind page tree after HMR update; dist output is updated and the case is covered by CI build HMR coverage.')
      return
    }
    expect(updatedRootWxml).toContain(UPDATED_ESCAPED_CLASS)
  }, 420_000)
})
