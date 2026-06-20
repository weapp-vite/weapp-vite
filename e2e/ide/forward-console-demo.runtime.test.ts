/* eslint-disable e18e/ban-dependencies -- e2e 需要启动真实 CLI 构建产物。 */
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execa } from 'execa'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  launchAutomator,
  startForwardConsole,
} from 'weapp-ide-cli'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..')
const APP_ROOT = path.resolve(WORKSPACE_ROOT, 'apps/forward-console-demo')
const LOG_CLICKED_RE = /\[mini:log\s*\]\s+\[forward-console-demo\] Log clicked/
const LOG_CLICKED_MESSAGE_RE = /\[forward-console-demo\] Log clicked/

function resolveAutomatorSessionFile(projectPath: string, port?: number) {
  const normalizedProjectPath = path.resolve(projectPath)
  const sessionKey = port ? `${normalizedProjectPath}#port-${port}` : normalizedProjectPath
  const encodedProjectPath = Buffer.from(sessionKey).toString('base64url')
  return path.join(os.tmpdir(), 'weapp-vite-automator-sessions', `${encodedProjectPath}.json`)
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe.sequential('forward-console-demo in real WeChat DevTools', () => {
  let forwardConsoleSession: Awaited<ReturnType<typeof startForwardConsole>> | undefined
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined

  beforeAll(async () => {
    await cleanupResidualIdeProcesses()
    await Promise.all([
      fs.rm(resolveAutomatorSessionFile(APP_ROOT), { force: true }).catch(() => {}),
    ])
  }, 60_000)

  afterAll(async () => {
    await forwardConsoleSession?.close().catch(() => {})
    forwardConsoleSession = undefined
    miniProgram?.disconnect?.()
    miniProgram = undefined
    await cleanupResidualIdeProcesses()
  }, 60_000)

  it('forwards console output after tapping demo buttons', async () => {
    await execa('pnpm', ['exec', 'wv', 'build'], {
      cwd: APP_ROOT,
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
      reject: true,
      stdin: 'ignore',
    })
    miniProgram = await launchAutomator({
      persistAsDefaultSession: true,
      preserveProjectRoot: true,
      projectPath: APP_ROOT,
      timeout: 60_000,
      trustProject: true,
    })
    const forwardedMessages: string[] = []
    forwardConsoleSession = await startForwardConsole({
      projectPath: APP_ROOT,
      logLevels: ['log', 'info', 'warn', 'error'],
      onLog(event) {
        forwardedMessages.push(`[mini:${event.level.padEnd(5)}] ${event.message}`)
      },
    })
    const page = await miniProgram.currentPage()
    const logButton = await page.$('.action-log')

    expect(logButton).toBeTruthy()
    await logButton.tap()

    const start = Date.now()
    while (Date.now() - start < 30_000 && !forwardedMessages.some(message => LOG_CLICKED_MESSAGE_RE.test(message))) {
      await delay(200)
    }
    expect(forwardedMessages.join('\n')).toMatch(LOG_CLICKED_RE)
  }, 360_000)
})
