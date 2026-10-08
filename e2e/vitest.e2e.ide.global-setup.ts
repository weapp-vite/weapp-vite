import type { DevtoolsHostLease } from './utils/devtoolsHostLifecycle'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { runWeappViteBuildWithLogCapture } from './utils/buildLog'
import { DEVTOOLS_HOST_CLAIMED_ENV } from './utils/devtoolsHostLifecycle'
import { DEVTOOLS_SKIP_REASON_ENV } from './utils/devtoolsSkip'
import {
  clearRuntimeWarningLog,
  ensureIdeWarningReportEnv,
  writeIdeWarningReport,
} from './utils/ideWarningReport'
import { resolveRuntimeProviderName } from './utils/runtimeProvider'

const DEFAULT_LOGIN_CHECK_PROJECT = path.resolve(import.meta.dirname, '../e2e-apps/base')
const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/bin/weapp-vite.js')
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

function isLaunchAppConfigReady(config: Record<string, any> | undefined) {
  if (!config) {
    return false
  }

  const pages = Array.isArray(config.pages) ? config.pages : []
  if (!pages.some(item => typeof item === 'string' && item.trim())) {
    return false
  }

  if (!Object.hasOwn(config, 'subPackages') || !Array.isArray(config.subPackages)) {
    return false
  }

  if (config.subpackages != null && !Array.isArray(config.subpackages)) {
    return false
  }

  const subPackages = [
    ...config.subPackages,
    ...(Array.isArray(config.subpackages) ? config.subpackages : []),
  ]
  return subPackages.every((subPackage) => {
    return subPackage
      && typeof subPackage === 'object'
      && Array.isArray((subPackage as Record<string, any>).pages)
  })
}

async function ensureLoginCheckProjectReady(projectPath: string) {
  const appConfigPath = path.resolve(projectPath, resolveMiniprogramRoot(projectPath), 'app.json')
  if (isLaunchAppConfigReady(readJsonObject(appConfigPath))) {
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

  let claimedHost: DevtoolsHostLease | undefined
  let teardown: Promise<void> | undefined
  const finish = () => {
    teardown ??= (async () => {
      const errors: unknown[] = []
      if (claimedHost) {
        try {
          const { quitClaimedDevtoolsHost } = await import('./utils/devtoolsHostLifecycle')
          await quitClaimedDevtoolsHost(claimedHost)
        }
        catch (error) {
          errors.push(error)
        }
      }
      try {
        writeIdeWarningReport(reportPaths)
      }
      catch (error) {
        errors.push(error)
      }
      if (errors.length === 1) {
        throw errors[0]
      }
      if (errors.length > 1) {
        throw new AggregateError(errors, 'IDE global teardown failed to release the claimed DevTools host.')
      }
    })()
    return teardown
  }

  try {
    if (resolveRuntimeProviderName() === 'headless') {
      return finish
    }

    if (!shouldRunDevtoolsLoginPreflight()) {
      return finish
    }

    // 直接运行单个 Vitest 文件也必须先取得冷宿主关闭权，避免登录预检或
    // automator 在未受管的窗口中启动新的 DevTools，导致多窗口堆积和 OOM。
    // suite runner 已经持有该任务的关闭权时，通过显式 marker 避免子进程重复认领。
    if (process.env[DEVTOOLS_HOST_CLAIMED_ENV] !== '1') {
      const { claimDevtoolsHost } = await import('./utils/devtoolsHostLifecycle')
      claimedHost = await claimDevtoolsHost(process.env.WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH?.trim())
    }

    const { preflightSelectedWechatDevtools } = await import('./utils/devtoolsSelection')
    await preflightSelectedWechatDevtools()

    if (process.env.WEAPP_VITE_E2E_SKIP_DEVTOOLS_LOGIN_CHECK === '1') {
      return finish
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
        return finish
      }
      if (isDevtoolsLoginRequiredError(error)) {
        const rawMessage = error instanceof Error ? error.message : String(error)
        const compactMessage = rawMessage.replace(WHITESPACE_RE, ' ').trim()
        const skipMessage = `WeChat DevTools 未登录，跳过 IDE 自动化用例。${compactMessage ? ` 原因: ${compactMessage.slice(0, 240)}` : ''}`
        process.env[DEVTOOLS_SKIP_REASON_ENV] = skipMessage
        process.stdout.write(`[warn] [runtime:launch-skip] ${skipMessage}\n`)
        return finish
      }
      throw error
    }
    clearRuntimeWarningLog(reportPaths.eventLogPath)

    return finish
  }
  catch (error) {
    try {
      await finish()
    }
    catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'IDE global setup failed and DevTools host cleanup did not complete.', { cause: error })
    }
    throw error
  }
}
