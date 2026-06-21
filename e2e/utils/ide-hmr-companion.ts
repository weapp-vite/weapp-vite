import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { beforeAll, expect } from 'vitest'
import {
  cleanupTrackedDevProcesses,
  startDevProcess,
} from './dev-process'
import { createDevProcessEnv } from './dev-process-env'
import { replaceFileByRename, waitForFileContains } from './hmr-helpers'
import { resolveRuntimeProviderName } from './runtimeProvider'

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..')
const BASE_APP_ROOT = path.resolve(WORKSPACE_ROOT, 'e2e-apps/base')
const COMPANION_ROOT = path.resolve(WORKSPACE_ROOT, '.tmp/e2e-ide-hmr-companion')
const CLI_PATH = path.resolve(WORKSPACE_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const INDEX_WXML = 'src/pages/index/index.wxml'
const INDEX_TS = 'src/pages/index/index.ts'
const INDEX_WXSS = 'src/pages/index/index.wxss'
const DIST_INDEX_WXML = 'dist/pages/index/index.wxml'
const DIST_INDEX_JS = 'dist/pages/index/index.js'
const DIST_INDEX_WXSS = 'dist/pages/index/index.wxss'
const HMR_COMPANION_ENABLED_ENV = 'WEAPP_VITE_E2E_IDE_HMR_COMPANION'
const TARGET_FILE_ENV = 'WEAPP_VITE_E2E_TARGET_FILE'

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForFileExcludes(filePath: string, marker: string, timeoutMs = 90_000) {
  const startedAt = Date.now()
  let latest = ''

  while (Date.now() - startedAt <= timeoutMs) {
    latest = await fs.readFile(filePath, 'utf8').catch(() => '')
    if (!latest.includes(marker)) {
      return latest
    }
    await delay(250)
  }

  throw new Error(`Timed out waiting for ${filePath} to exclude marker: ${marker}\nLatest content:\n${latest.slice(0, 1000)}`)
}

async function copyBaseFixture(targetRoot: string) {
  await fs.rm(targetRoot, { force: true, recursive: true })
  await fs.mkdir(path.dirname(targetRoot), { recursive: true })
  await fs.cp(BASE_APP_ROOT, targetRoot, {
    dereference: false,
    filter(source) {
      const relative = path.relative(BASE_APP_ROOT, source).replaceAll('\\', '/')
      return !relative.startsWith('dist')
        && !relative.startsWith('.turbo')
        && !relative.startsWith('.weapp-vite')
        && !relative.startsWith('node_modules')
    },
    recursive: true,
  })
}

function resolveTargetFileLabel() {
  const envTarget = process.env[TARGET_FILE_ENV]?.trim()
  if (envTarget) {
    return envTarget.replaceAll('\\', '/')
  }

  const cwd = process.cwd()
  const targetArg = process.argv
    .map(arg => arg.replaceAll('\\', '/'))
    .find(arg => arg.includes('e2e/ide/') && arg.endsWith('.test.ts'))
  if (!targetArg) {
    return 'ide/__current__.test.ts'
  }

  const resolvedTargetArg = path.isAbsolute(targetArg)
    ? targetArg
    : path.resolve(cwd, targetArg)

  return path.relative(path.resolve(import.meta.dirname, '..'), resolvedTargetArg).replaceAll('\\', '/')
}

function shouldRegisterIdeHmrCompanion(targetLabel: string) {
  if (resolveRuntimeProviderName() !== 'devtools') {
    return false
  }
  if (process.env[HMR_COMPANION_ENABLED_ENV] === '0') {
    return false
  }
  return targetLabel.startsWith('ide/')
}

async function runIdeHmrCompanion(targetLabel: string) {
  process.stdout.write(`[ide-hmr-companion] start target=${targetLabel}\n`)
  const projectRoot = path.join(COMPANION_ROOT, targetLabel.replace(/[\\/]/g, '__'))
  const indexWxmlPath = path.join(projectRoot, INDEX_WXML)
  const indexTsPath = path.join(projectRoot, INDEX_TS)
  const indexWxssPath = path.join(projectRoot, INDEX_WXSS)
  let devProcess: ReturnType<typeof startDevProcess> | undefined

  await copyBaseFixture(projectRoot)

  const originalWxml = await fs.readFile(indexWxmlPath, 'utf8')
  const originalTs = await fs.readFile(indexTsPath, 'utf8')
  const originalWxss = await fs.readFile(indexWxssPath, 'utf8')
  const initialText = `HMR companion initial ${Date.now()}`
  const updatedText = `HMR companion updated ${Date.now()}`
  const initialData = `hmr-companion-data-initial-${Date.now()}`
  const updatedData = `hmr-companion-data-updated-${Date.now()}`

  try {
    await replaceFileByRename(indexWxmlPath, originalWxml.replace('Hello', initialText))
    await replaceFileByRename(indexTsPath, originalTs.replace('target: \'index snapshot\'', `target: '${initialData}'`))
    await replaceFileByRename(indexWxssPath, originalWxss.replace('background: #f8fafc;', 'background: #f8fafc;'))

    devProcess = startDevProcess(process.execPath, [CLI_PATH, 'dev', '--non-interactive'], {
      cwd: projectRoot,
      env: createDevProcessEnv(),
      reject: false,
    })

    await Promise.all([
      devProcess.waitFor(waitForFileContains(path.join(projectRoot, DIST_INDEX_WXML), initialText, 90_000), 'HMR companion initial WXML emit'),
      devProcess.waitFor(waitForFileContains(path.join(projectRoot, DIST_INDEX_JS), initialData, 90_000), 'HMR companion initial JS emit'),
    ])
    expect(await fs.readFile(path.join(projectRoot, DIST_INDEX_WXSS), 'utf8')).toContain('#f8fafc')

    await replaceFileByRename(indexWxmlPath, originalWxml.replace('Hello', updatedText))
    await waitForFileContains(path.join(projectRoot, DIST_INDEX_WXML), updatedText, 90_000)
    await waitForFileExcludes(path.join(projectRoot, DIST_INDEX_WXML), initialText, 90_000)

    await replaceFileByRename(indexTsPath, originalTs.replace('target: \'index snapshot\'', `target: '${updatedData}'`))
    await waitForFileContains(path.join(projectRoot, DIST_INDEX_JS), updatedData, 90_000)
    await waitForFileExcludes(path.join(projectRoot, DIST_INDEX_JS), initialData, 90_000)

    await replaceFileByRename(indexWxssPath, originalWxss.replace('background: #f8fafc;', 'background: #dcfce7;'))
    await waitForFileContains(path.join(projectRoot, DIST_INDEX_WXSS), '#dcfce7', 90_000)
    await waitForFileExcludes(path.join(projectRoot, DIST_INDEX_WXSS), '#f8fafc', 90_000)
    process.stdout.write(`[ide-hmr-companion] pass target=${targetLabel}\n`)
  }
  finally {
    await devProcess?.stop().catch(() => {})
    await cleanupTrackedDevProcesses()
    await fs.rm(projectRoot, { force: true, recursive: true }).catch(() => {})
  }
}

export function registerIdeHmrCompanion(shouldSkip: () => boolean = () => false) {
  const targetLabel = resolveTargetFileLabel()
  if (!shouldRegisterIdeHmrCompanion(targetLabel)) {
    return
  }

  beforeAll(async () => {
    if (shouldSkip()) {
      return
    }
    await runIdeHmrCompanion(targetLabel)
  }, 420_000)
}
