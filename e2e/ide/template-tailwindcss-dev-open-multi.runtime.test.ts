import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { isLikelyRelaunchRetryableError } from '../utils/automator'
import { waitForOpenedAutomator } from '../utils/opened-automator'
import {
  resolveTemplateDevOpenProjectRoot,
  TEMPLATE_DEV_OPEN_CASES,
} from './template-dev-open-cases'

const ACTIVE_TEMPLATE_NAME = process.env.WEAPP_VITE_E2E_TEMPLATE?.trim()
const PREVIOUS_TEMPLATE_NAME = process.env.WEAPP_VITE_E2E_PREVIOUS_TEMPLATE?.trim()
const USE_PRESTARTED_TEMPLATE_DEV = process.env.WEAPP_VITE_E2E_PRESTARTED_TEMPLATE_DEV === '1'
const MULTI_TEMPLATE_NAMES = new Set([
  'weapp-vite-tailwindcss-template',
  'weapp-vite-tailwindcss-vant-template',
  'weapp-vite-tailwindcss-tdesign-template',
])
const ACTIVE_TEMPLATE_CASES = TEMPLATE_DEV_OPEN_CASES.filter((templateCase) => {
  return MULTI_TEMPLATE_NAMES.has(templateCase.name)
    && (!ACTIVE_TEMPLATE_NAME || templateCase.name === ACTIVE_TEMPLATE_NAME)
})

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function normalizeRoutePath(routePath: string) {
  return routePath.split('?', 1)[0].split('#', 1)[0].replace(/^\/+/, '').replace(/\/+$/g, '')
}

function valueContainsText(value: unknown, text: string) {
  if (typeof value === 'string') {
    return value.includes(text)
  }
  if (Array.isArray(value)) {
    return value.some(item => valueContainsText(item, text))
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some(item => valueContainsText(item, text))
  }
  return false
}

function isDevtoolsProtocolTimeout(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }
  const protocolError = error as Error & { code?: unknown, method?: unknown }
  return protocolError.code === 'DEVTOOLS_PROTOCOL_TIMEOUT'
    && (
      protocolError.method === 'App.callFunction'
      || protocolError.method === 'App.getCurrentPage'
      || protocolError.method === 'App.getPageStack'
    )
}

async function waitForPageText(miniProgram: any, route: string, text: string, timeoutMs = 90_000) {
  const normalizedRoute = normalizeRoutePath(route)
  const deadline = Date.now() + timeoutMs
  let latestWxml = ''
  let latestRoute = ''
  let lastProtocolTimeout = ''

  while (Date.now() <= deadline) {
    try {
      const currentPage = await miniProgram.currentPage?.()
      latestRoute = String(currentPage?.path ?? '')
      const page = normalizeRoutePath(latestRoute) === normalizedRoute
        ? currentPage
        : await miniProgram.reLaunch(route)
      latestRoute = String(page?.path ?? latestRoute)
      await page.waitFor(500)
      try {
        latestWxml = await page.waitForRendered({
          text,
          timeout: Math.min(5_000, Math.max(1, deadline - Date.now())),
        })
        return latestWxml
      }
      catch {
        // 继续读取 WXML 和页面数据，保留稳定语义与失败上下文。
      }
      const root = await page.$('page')
      latestWxml = root ? await root.outerWxml() : ''
      if (latestWxml.includes(text)) {
        return latestWxml
      }
      const data = await page.data(undefined, {
        routeOnly: true,
        timeout: 3_000,
      }).catch(() => undefined)
      if (valueContainsText(data, text)) {
        return JSON.stringify(data)
      }
    }
    catch (error) {
      if (!isDevtoolsProtocolTimeout(error) && !isLikelyRelaunchRetryableError(error)) {
        throw error
      }
      lastProtocolTimeout = error instanceof Error ? error.message : String(error)
    }
    await delay(1_000)
  }

  const timeoutDetail = lastProtocolTimeout ? `\nLatest DevTools protocol timeout: ${lastProtocolTimeout}` : ''
  throw new Error(`Timed out waiting for rendered text "${text}".${timeoutDetail}\nLatest route: ${latestRoute || '<unknown>'}\nLatest WXML:\n${latestWxml.slice(0, 1000)}`)
}

describe('template TailwindCSS dev:open multi-project IDE integration', { concurrent: false }, () => {
  it.each(ACTIVE_TEMPLATE_CASES)('$name renders after the previous dev:open process exits', async (templateCase) => {
    expect(USE_PRESTARTED_TEMPLATE_DEV, '该场景必须通过外层 template dev:open runner 执行').toBe(true)
    expect(ACTIVE_TEMPLATE_CASES).toHaveLength(1)

    const projectRoot = resolveTemplateDevOpenProjectRoot(templateCase)
    const session = await waitForOpenedAutomator(projectRoot, {
      readyRoute: templateCase.route,
      timeoutMs: 120_000,
    })
    try {
      expect(path.resolve(session.metadata.projectPath)).toBe(projectRoot)
      expect(session.metadata.wsEndpoint).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/)
      expect(JSON.parse(await fs.readFile(path.join(projectRoot, 'project.config.json'), 'utf8'))).toMatchObject({
        miniprogramRoot: 'dist/',
        srcMiniprogramRoot: 'dist/',
      })
      await waitForPageText(session.miniProgram, templateCase.route, templateCase.expectedText)

      if (PREVIOUS_TEMPLATE_NAME) {
        const previousTemplateCase = TEMPLATE_DEV_OPEN_CASES.find(item => item.name === PREVIOUS_TEMPLATE_NAME)
        expect(previousTemplateCase).toBeDefined()
        expect(resolveTemplateDevOpenProjectRoot(previousTemplateCase!)).not.toBe(projectRoot)
      }
    }
    finally {
      session.miniProgram.disconnect?.()
    }
  }, 180_000)
})
