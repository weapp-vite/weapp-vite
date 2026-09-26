import { spawn } from 'node:child_process'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

const NEWLINE_RE = /\r?\n/

export function formatCommand(command, args) {
  return [command, ...args].join(' ')
}

export function tail(text, maxLines = 80) {
  const lines = text.trim().split(NEWLINE_RE).filter(Boolean)
  return lines.slice(-maxLines).join('\n')
}

export function createChildProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    ...options,
    windowsHide: true,
  })
  return child
}

export async function terminateProcess(child) {
  if (!child.pid) {
    return
  }

  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    await new Promise(resolve => killer.once('close', resolve))
    return
  }

  try {
    process.kill(-child.pid, 'SIGTERM')
  }
  catch {
    child.kill('SIGTERM')
  }

  const settled = await Promise.race([
    new Promise(resolve => child.once('close', resolve)),
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
    new Promise((resolve) => {
      child.once('close', () => resolve(true))
      child.once('error', () => resolve(true))
    }),
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
