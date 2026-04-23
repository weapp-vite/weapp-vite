import { EventEmitter } from 'node:events'
import fs from 'node:fs/promises'
import os from 'node:os'

import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import {
  cleanupChildProcessHandles,
  hasSuccessfulRebuildSince,
  waitForChildClose,
  waitForFileChangeOrSuccessfulRebuild,
} from '../../../scripts/create-weapp-vite-smoke.mjs'

describe('create-weapp-vite smoke helpers', () => {
  it('detects rebuild logs only from newly appended output', () => {
    const previousOutput = '[success] 小程序初次构建完成，耗时：879ms\n'
    const nextOutput = `${previousOutput}[success] 小程序已重新构建（89.92 ms）\n`

    expect(hasSuccessfulRebuildSince(previousOutput, 0)).toBe(false)
    expect(hasSuccessfulRebuildSince(nextOutput, previousOutput.length)).toBe(true)
  })

  it('resolves update waits from rebuild logs when dist output is unchanged', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'create-weapp-vite-smoke-test-'))
    const distFile = path.join(tempRoot, 'app.json')
    await fs.writeFile(distFile, '{"pages":["pages/index/index"]}\n', 'utf8')
    const previousMtimeMs = (await fs.stat(distFile)).mtimeMs
    const stdoutChunks = ['[success] 小程序初次构建完成，耗时：879ms\n']
    const previousStdoutLength = stdoutChunks.join('').length

    setTimeout(() => {
      stdoutChunks.push('[success] 小程序已重新构建（89.92 ms）\n')
    }, 20)

    await expect(waitForFileChangeOrSuccessfulRebuild({
      file: distFile,
      previousMtimeMs,
      stdoutChunks,
      previousStdoutLength,
      timeoutMs: 500,
      pollIntervalMs: 10,
    })).resolves.toBeGreaterThanOrEqual(0)
  })

  it('force-cleans lingering dev child handles when close never arrives', async () => {
    const child = new EventEmitter() as EventEmitter & {
      exitCode: number | null
      stdout: { destroy: ReturnType<typeof vi.fn> }
      stderr: { destroy: ReturnType<typeof vi.fn> }
      stdin: { destroy: ReturnType<typeof vi.fn> }
      unref: ReturnType<typeof vi.fn>
      removeAllListeners: EventEmitter['removeAllListeners']
    }

    child.exitCode = null
    child.stdout = { destroy: vi.fn() }
    child.stderr = { destroy: vi.fn() }
    child.stdin = { destroy: vi.fn() }
    child.unref = vi.fn()

    await expect(waitForChildClose(child, 20)).resolves.toBe(false)

    cleanupChildProcessHandles(child)

    expect(child.stdout.destroy).toHaveBeenCalledTimes(1)
    expect(child.stderr.destroy).toHaveBeenCalledTimes(1)
    expect(child.stdin.destroy).toHaveBeenCalledTimes(1)
    expect(child.unref).toHaveBeenCalledTimes(1)
  })

  it('waits for close even after exitCode is already set', async () => {
    const child = new EventEmitter() as EventEmitter & {
      exitCode: number | null
    }

    child.exitCode = 0

    setTimeout(() => {
      child.emit('close')
    }, 20)

    await expect(waitForChildClose(child, 100)).resolves.toBe(true)
  })
})
