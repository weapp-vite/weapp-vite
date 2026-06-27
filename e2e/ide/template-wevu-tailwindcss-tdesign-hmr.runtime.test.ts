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
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..')
const TEMPLATE_ROOT = path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-wevu-tailwindcss-tdesign-template')
const INDEX_VUE = path.resolve(TEMPLATE_ROOT, 'src/pages/index/index.vue')
const INDEX_ROUTE = '/pages/index/index'
const INITIAL_CARD_CLASS = 'rounded-[28rpx] bg-white p-[28rpx]'
const UPDATED_CARD_CLASS = 'rounded-[28rpx] bg-[red] p-[28rpx]'
const IDE_AUTOMATOR_INFRA_RE = /Failed connecting to ws:\/\/127\.0\.0\.1:\d+|无法连接到当前项目的微信开发者工具自动化 websocket|Cannot connect to the Wechat DevTools automation websocket|automation websocket|Connection closed, check if wechat web devTools is still running|WebSocket is not open|socket hang up|Wait timed out after \d+ ms|当前项目已完成打开流程，但尚未连接到可复用的自动化会话/i

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

function isIdeAutomatorInfraError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return IDE_AUTOMATOR_INFRA_RE.test(message)
}

async function waitForDevOutputOrSkip(
  ctx: { skip: (message?: string) => void },
  devProcess: ReturnType<typeof startDevProcess>,
  matcher: string | RegExp,
  description: string,
) {
  try {
    return await devProcess.waitForOutput(matcher, description)
  }
  catch (error) {
    if (isIdeAutomatorInfraError(error)) {
      ctx.skip(`WeChat DevTools 自动化会话不可用，跳过 wevu TailwindCSS TDesign HMR IDE 用例。reason=${error instanceof Error ? error.message : String(error)}`)
      return ''
    }
    throw error
  }
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

async function waitForFileContains(filePath: string, expected: string, timeoutMs = 90_000) {
  const start = Date.now()
  let latest = ''

  while (Date.now() - start <= timeoutMs) {
    latest = await fs.readFile(filePath, 'utf8').catch(() => '')
    if (latest.includes(expected)) {
      return latest
    }
    await delay(500)
  }

  throw new Error(`Timed out waiting for ${path.relative(WORKSPACE_ROOT, filePath)} to contain ${expected}.\nLatest content:\n${latest.slice(0, 1000)}`)
}

describe.sequential('template wevu TailwindCSS TDesign HMR in real WeChat DevTools', () => {
  let restoreVue = ''
  let initialVue = ''
  let miniProgram: any
  let devProcess: ReturnType<typeof startDevProcess> | undefined

  beforeAll(async () => {
    restoreVue = await fs.readFile(INDEX_VUE, 'utf8')
    if (!restoreVue.includes(INITIAL_CARD_CLASS) && !restoreVue.includes(UPDATED_CARD_CLASS)) {
      throw new Error(`Expected ${INDEX_VUE} to contain the Tailwind HMR card class`)
    }
    initialVue = restoreVue.replace(UPDATED_CARD_CLASS, INITIAL_CARD_CLASS)
    if (initialVue !== restoreVue) {
      await fs.writeFile(INDEX_VUE, initialVue, 'utf8')
    }
    await cleanupResidualIdeProcesses()
    await Promise.all([
      fs.rm(resolveAutomatorSessionFile(TEMPLATE_ROOT), { force: true }).catch(() => {}),
      fs.rm(resolveAutomatorSessionFile(TEMPLATE_ROOT, resolveProjectAutomatorPort(TEMPLATE_ROOT)), { force: true }).catch(() => {}),
    ])
  }, 60_000)

  afterAll(async () => {
    if (restoreVue) {
      await fs.writeFile(INDEX_VUE, restoreVue, 'utf8').catch(() => {})
    }
    if (miniProgram) {
      await miniProgram.disconnect?.()
      miniProgram = undefined
    }
    await closeSharedMiniProgram(TEMPLATE_ROOT).catch(() => {})
    await devProcess?.stop().catch(() => {})
    await cleanupTrackedDevProcesses()
    await cleanupResidualIdeProcesses()
  }, 60_000)

  it('keeps wevu internal runtime bundled after bg-white changes to bg-[red]', async (ctx) => {
    devProcess = startDevProcess('pnpm', ['exec', 'wv', 'dev', '-o', '--non-interactive', '--login-retry', 'never'], {
      cwd: TEMPLATE_ROOT,
      env: createDevProcessEnv(),
      reject: false,
    })
    const initialBuildOutput = await waitForDevOutputOrSkip(
      ctx,
      devProcess,
      /小程序初次构建完成|无法连接到当前项目的微信开发者工具自动化 websocket|当前项目已完成打开流程，但尚未连接到可复用的自动化会话/,
      'wevu tailwindcss tdesign initial build',
    )
    if (!initialBuildOutput) {
      return
    }
    if (isIdeAutomatorInfraError(initialBuildOutput) && !initialBuildOutput.includes('小程序初次构建完成')) {
      ctx.skip(`WeChat DevTools 自动化会话不可用，跳过 wevu TailwindCSS TDesign HMR IDE 用例。reason=${initialBuildOutput}`)
      return
    }
    const devReadyOutput = await waitForDevOutputOrSkip(
      ctx,
      devProcess,
      /开发服务已就绪|无法连接到当前项目的微信开发者工具自动化 websocket|当前项目已完成打开流程，但尚未连接到可复用的自动化会话/,
      'wevu tailwindcss tdesign dev ready',
    )
    if (!devReadyOutput) {
      return
    }
    if (isIdeAutomatorInfraError(devReadyOutput) && !devReadyOutput.includes('开发服务已就绪')) {
      ctx.skip(`WeChat DevTools 自动化会话不可用，跳过 wevu TailwindCSS TDesign HMR IDE 用例。reason=${devReadyOutput}`)
      return
    }
    try {
      miniProgram = await devProcess.waitFor(
        waitForOpenedAutomator(TEMPLATE_ROOT, 180_000),
        'wevu tailwindcss tdesign dev:open ready',
      )
    }
    catch (error) {
      if (isIdeAutomatorInfraError(error)) {
        ctx.skip(`WeChat DevTools 自动化会话不可用，跳过 wevu TailwindCSS TDesign HMR IDE 用例。reason=${error instanceof Error ? error.message : String(error)}`)
        return
      }
      throw error
    }
    const collector = attachRuntimeErrorCollector(miniProgram)

    try {
      await waitForCurrentRoute(miniProgram)
      const marker = collector.mark()
      const updatedVue = initialVue.replace(INITIAL_CARD_CLASS, UPDATED_CARD_CLASS)
      expect(updatedVue).not.toBe(initialVue)
      await fs.writeFile(INDEX_VUE, updatedVue, 'utf8')
      await devProcess.waitForOutput('[update] src/pages/index/index.vue', 'wevu tdesign HMR update log')
      await devProcess.waitForOutput(/小程序已重新构建（[\d.]+ ms）/, 'wevu tdesign HMR rebuild log')
      await waitForFileContains(path.join(TEMPLATE_ROOT, 'dist/app.js'), 'weapp-vendors/')
      await waitForCurrentRoute(miniProgram)

      const runtimeErrors = collector.getSince(marker)
      expect(runtimeErrors).not.toEqual(expect.arrayContaining([
        expect.stringContaining('wevu/internal-runtime'),
      ]))
      expect(await fs.readFile(path.join(TEMPLATE_ROOT, 'dist/app.js'), 'utf8')).not.toContain('from "wevu/internal-runtime"')
    }
    finally {
      collector.dispose()
    }
  }, 420_000)
})
