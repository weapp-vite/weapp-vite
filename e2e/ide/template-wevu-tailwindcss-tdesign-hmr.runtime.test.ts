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
import { attachRuntimeErrorCollector } from './runtimeErrors'

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..')
const TEMPLATE_ROOT = path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-wevu-tailwindcss-tdesign-template')
const INDEX_VUE = path.resolve(TEMPLATE_ROOT, 'src/pages/index/index.vue')
const INDEX_ROUTE = '/pages/index/index'
const INITIAL_CARD_CLASS = 'rounded-[28rpx] bg-white p-[28rpx]'
const UPDATED_CARD_CLASS = 'rounded-[28rpx] bg-[red] p-[28rpx]'

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

async function waitForPageText(miniProgram: any, text: string, timeoutMs = 90_000) {
  const start = Date.now()
  let latestWxml = ''

  while (Date.now() - start <= timeoutMs) {
    const page = await miniProgram.reLaunch(INDEX_ROUTE)
    await page.waitFor(500)
    const root = await page.$('page')
    latestWxml = root ? await root.outerWxml() : ''
    if (latestWxml.includes(text)) {
      return latestWxml
    }
    await delay(1_000)
  }

  throw new Error(`Timed out waiting for rendered text "${text}".\nLatest WXML:\n${latestWxml.slice(0, 1000)}`)
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
  }, 60_000)

  it('keeps wevu internal runtime bundled after bg-white changes to bg-[red]', async () => {
    devProcess = startDevProcess('pnpm', ['exec', 'wv', 'dev', '-o', '--non-interactive', '--login-retry', 'never'], {
      cwd: TEMPLATE_ROOT,
      env: createDevProcessEnv(),
      reject: false,
    })
    miniProgram = await devProcess.waitFor(
      waitForOpenedAutomator(TEMPLATE_ROOT, 180_000),
      'wevu tailwindcss tdesign dev:open ready',
    )
    const collector = attachRuntimeErrorCollector(miniProgram)

    try {
      await waitForPageText(miniProgram, 'TDesign 最小模板')
      const marker = collector.mark()
      const updatedVue = initialVue.replace(INITIAL_CARD_CLASS, UPDATED_CARD_CLASS)
      expect(updatedVue).not.toBe(initialVue)
      await fs.writeFile(INDEX_VUE, updatedVue, 'utf8')
      await waitForFileContains(path.join(TEMPLATE_ROOT, 'dist/app.js'), 'weapp-vendors/')
      await waitForPageText(miniProgram, 'TDesign 最小模板')

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
