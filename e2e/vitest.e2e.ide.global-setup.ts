import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { runWeappViteBuildWithLogCapture } from './utils/buildLog'
import {
  clearRuntimeWarningLog,
  ensureIdeWarningReportEnv,
  writeIdeWarningReport,
} from './utils/ideWarningReport'
import { resolveRuntimeProviderName } from './utils/runtimeProvider'

const DEFAULT_LOGIN_CHECK_PROJECT = path.resolve(import.meta.dirname, '../e2e-apps/base')
const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/bin/weapp-vite.js')
const DEVTOOLS_SKIP_REASON_ENV = 'WEAPP_VITE_E2E_SKIP_DEVTOOLS_REASON'
const WHITESPACE_RE = /\s+/g

function readJsonObject(filePath: string): Record<string, any> | undefined {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(content)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, any> : undefined
  }
  catch {
    return undefined
  }
}

function resolveMiniprogramRoot(projectPath: string) {
  for (const fileName of ['project.config.json', 'project.private.config.json']) {
    const config = readJsonObject(path.join(projectPath, fileName))
    const miniprogramRoot = config?.miniprogramRoot
    if (typeof miniprogramRoot === 'string' && miniprogramRoot.trim()) {
      return miniprogramRoot.trim()
    }
  }
  return 'dist'
}

async function ensureLoginCheckProjectReady(projectPath: string) {
  const appConfigPath = path.resolve(projectPath, resolveMiniprogramRoot(projectPath), 'app.json')
  if (fs.existsSync(appConfigPath)) {
    return
  }

  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: projectPath,
    platform: 'weapp',
    cwd: projectPath,
    label: 'ide:login-preflight',
    skipNpm: true,
  })
}

function shouldRunDevtoolsLoginPreflight() {
  const argv = process.argv.map(arg => arg.replaceAll('\\', '/'))
  const hasIdeTargets = argv.some(arg => arg.includes('e2e/ide/'))
  if (hasIdeTargets) {
    return true
  }

  const hasOnlyCiTargets = argv.some(arg => arg.includes('e2e/ci/'))
  if (hasOnlyCiTargets) {
    return false
  }

  return true
}

export default async function setupIdeE2E() {
  const reportPaths = ensureIdeWarningReportEnv()
  delete process.env[DEVTOOLS_SKIP_REASON_ENV]

  if (resolveRuntimeProviderName() === 'headless') {
    return async () => {
      writeIdeWarningReport(reportPaths)
    }
  }

  if (process.env.WEAPP_VITE_E2E_SKIP_DEVTOOLS_LOGIN_CHECK === '1') {
    return async () => {
      writeIdeWarningReport(reportPaths)
    }
  }
  if (!shouldRunDevtoolsLoginPreflight()) {
    return async () => {
      writeIdeWarningReport(reportPaths)
    }
  }

  const { cleanupResidualIdeProcesses } = await import('./utils/ide-devtools-cleanup')
  await cleanupResidualIdeProcesses()

  const {
    assertDevtoolsLoggedIn,
    isDevtoolsLoginRequiredError,
    isDevtoolsHttpPortError,
  } = await import('./utils/automator')
  const projectPath = process.env.WEAPP_VITE_E2E_LOGIN_CHECK_PROJECT_PATH || DEFAULT_LOGIN_CHECK_PROJECT
  await ensureLoginCheckProjectReady(projectPath)
  try {
    await assertDevtoolsLoggedIn(projectPath)
  }
  catch (error) {
    if (isDevtoolsHttpPortError(error)) {
      const rawMessage = error instanceof Error ? error.message : String(error)
      const compactMessage = rawMessage.replace(WHITESPACE_RE, ' ').trim()
      const skipMessage = `WeChat DevTools 基础设施不可用，跳过 IDE 自动化用例。${compactMessage ? ` 原因: ${compactMessage.slice(0, 240)}` : ''}`
      process.env[DEVTOOLS_SKIP_REASON_ENV] = skipMessage
      process.stdout.write(`[warn] [runtime:launch-skip] ${skipMessage}\n`)
      return async () => {
        writeIdeWarningReport(reportPaths)
      }
    }
    if (isDevtoolsLoginRequiredError(error)) {
      const rawMessage = error instanceof Error ? error.message : String(error)
      const compactMessage = rawMessage.replace(WHITESPACE_RE, ' ').trim()
      const skipMessage = `WeChat DevTools 未登录，跳过 IDE 自动化用例。${compactMessage ? ` 原因: ${compactMessage.slice(0, 240)}` : ''}`
      process.env[DEVTOOLS_SKIP_REASON_ENV] = skipMessage
      process.stdout.write(`[warn] [runtime:launch-skip] ${skipMessage}\n`)
      return async () => {
        writeIdeWarningReport(reportPaths)
      }
    }
    throw error
  }
  clearRuntimeWarningLog(reportPaths.eventLogPath)

  return async () => {
    writeIdeWarningReport(reportPaths)
  }
}
