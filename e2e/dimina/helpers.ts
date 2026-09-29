/* eslint-disable e18e/ban-dependencies -- 使用跨平台子进程管理测试服务。 */
import type { Subprocess } from 'execa'
import type { Page } from 'playwright'
import nodeProcess from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { expect } from 'vitest'
import { root } from '../../packages-private/dimina-playground/config'

export async function stopHost(process?: Subprocess) {
  if (!process) {
    return
  }
  process.kill('SIGTERM')
  const forceKill = setTimeout(() => process.kill('SIGKILL'), 5000)
  try {
    await process.catch(() => undefined)
  }
  finally {
    clearTimeout(forceKill)
  }
}

export async function startHost(mode: 'dev' | 'preview') {
  const cli = fileURLToPath(new URL('./bin/vite.js', import.meta.resolve('vite/package.json')))
  const process = execa(nodeProcess.execPath, [cli, ...(mode === 'preview' ? ['preview'] : []), '--host', '127.0.0.1', '--port', '0'], { cwd: root, reject: false })
  let logs = ''
  process.stdout?.on('data', (chunk) => {
    logs += String(chunk)
  })
  process.stderr?.on('data', (chunk) => {
    logs += String(chunk)
  })
  try {
    const started = Date.now()
    while (Date.now() - started < 30_000) {
      if (process.nodeChildProcess.exitCode !== null) {
        throw new Error(`Dimina host exited: ${logs}`)
      }
      const url = logs.match(/http:\/\/(?:127\.0\.0\.1|localhost):\d+\/dimina\//)?.[0]
      if (url) {
        return { process, url, logs: () => logs }
      }
      await delay(100)
    }
    throw new Error(`Dimina host timed out: ${logs}`)
  }
  catch (error) {
    await stopHost(process)
    throw error
  }
}

export function content(page: Page) {
  return page.frameLocator('iframe.dimina-native-webview__window:visible').last()
}

export async function visible(page: Page, text: string) {
  await expect.poll(() => content(page).getByText(text, { exact: true }).isVisible(), { timeout: 30_000 }).toBe(true)
}
