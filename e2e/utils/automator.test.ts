import { spawn } from 'node:child_process'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { terminateBridgeCliProcess } from './automator'

function waitForSpawn(child: ReturnType<typeof spawn>) {
  return new Promise<number>((resolve, reject) => {
    if (typeof child.pid === 'number' && child.pid > 0) {
      resolve(child.pid)
      return
    }

    child.once('spawn', () => {
      if (typeof child.pid === 'number' && child.pid > 0) {
        resolve(child.pid)
        return
      }
      reject(new Error('Failed to get child pid after spawn'))
    })
    child.once('error', reject)
  })
}

function isMissingProcessError(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === 'ESRCH'
}

async function waitForProcessGone(pid: number, timeoutMs = 3_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      process.kill(pid, 0)
    }
    catch (error) {
      if (isMissingProcessError(error)) {
        return
      }
      throw error
    }
    await new Promise(resolve => setTimeout(resolve, 120))
  }
  throw new Error(`Timed out waiting pid=${pid} to exit after ${timeoutMs}ms`)
}

describe('automator', () => {
  it('terminates detached bridge cli processes', async () => {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 10_000)'], {
      detached: process.platform !== 'win32',
      stdio: 'ignore',
    })
    child.unref()

    const pid = await waitForSpawn(child)
    await terminateBridgeCliProcess(pid)

    await expect(waitForProcessGone(pid)).resolves.toBeUndefined()
  })
})
