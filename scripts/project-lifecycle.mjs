/* eslint-disable e18e/ban-dependencies -- tutorial and smoke orchestration need execa for cross-platform process control. */
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { execa } from 'execa'

const NEWLINE_RE = /\r?\n/

export function formatCommand(command, args) {
  return [command, ...args].join(' ')
}

export function tail(text, maxLines = 80) {
  const lines = text.trim().split(NEWLINE_RE).filter(Boolean)
  return lines.slice(-maxLines).join('\n')
}

export function createChildProcess(command, args, options = {}) {
  return execa(command, args, {
    ...options,
    reject: false,
    windowsHide: true,
  })
}

export async function terminateProcess(child) {
  if (!child.pid) {
    return
  }

  if (process.platform === 'win32') {
    await execa('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      reject: false,
      stdio: 'ignore',
      windowsHide: true,
    })
    return
  }

  try {
    process.kill(-child.pid, 'SIGTERM')
  }
  catch {
    child.kill('SIGTERM')
  }

  const settled = await Promise.race([
    child.then(() => true, () => true),
    delay(10_000).then(() => false),
  ])
  if (!settled) {
    try {
      process.kill(-child.pid, 'SIGKILL')
    }
    catch {
      child.kill('SIGKILL')
    }
  }
}

export async function waitForChildClose(child, timeoutMs = 10_000) {
  if (typeof child.then !== 'function') {
    let settled = false
    await Promise.race([
      new Promise((resolve) => {
        child.once('close', () => {
          settled = true
          resolve()
        })
        child.once('error', () => {
          settled = true
          resolve()
        })
      }),
      delay(timeoutMs),
    ])
    return settled
  }

  return await Promise.race([
    child.then(() => true, () => true),
    delay(timeoutMs).then(() => false),
  ])
}

export function cleanupChildProcessHandles(child) {
  child.removeAllListeners?.('close')
  child.removeAllListeners?.('error')
  child.stdout?.destroy?.()
  child.stderr?.destroy?.()
  child.stdin?.destroy?.()
  child.unref?.()
}
