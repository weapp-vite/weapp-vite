import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { measureFileMarkerUpdate } from '../scripts/utils/hmrOutput'

describe('benchmark emitted HMR completion', () => {
  let tempDir: string
  let outputPath: string
  const marker = 'updated-template-marker'

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'benchmark-hmr-output-'))
    outputPath = path.join(tempDir, 'index.wxml')
    await writeFile(outputPath, '<view>previous-template-marker</view>')
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(tempDir, { recursive: true, force: true })
  })

  it('rejects old output even when matching compiler activity is logged', async () => {
    await expect(measureFileMarkerUpdate({
      outputPath,
      marker,
      timeoutMs: 50,
      update: () => writeFile(path.join(tempDir, 'dev.log'), `hmr emit dirty=1 resolved=1 emitAll=false pending=0\n${marker}`),
    })).rejects.toThrow('Timed out waiting for emitted HMR marker')
    expect(await readFile(outputPath, 'utf8')).toContain('previous-template-marker')
  })

  it('waits for the actual template marker using a monotonic clock', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Number.MAX_SAFE_INTEGER)
    let pendingWrite: Promise<void> | undefined
    try {
      const elapsedMs = await measureFileMarkerUpdate({
        outputPath,
        marker,
        timeoutMs: 2_000,
        update: async () => {
          pendingWrite = setTimeout(30).then(() => writeFile(outputPath, `<view>${marker}</view>`))
        },
      })
      expect(elapsedMs).toBeGreaterThan(0)
      expect(Number.isFinite(elapsedMs)).toBe(true)
      expect(await readFile(outputPath, 'utf8')).toContain(marker)
    }
    finally {
      await pendingWrite
    }
  })

  it('rejects a marker already present before the source update', async () => {
    await writeFile(outputPath, `<view>${marker}</view>`)
    const update = vi.fn(async () => {})
    await expect(measureFileMarkerUpdate({ outputPath, marker, update, timeoutMs: 50 }))
      .rejects
      .toThrow('already contains the update marker')
    expect(update).not.toHaveBeenCalled()
  })

  it('requires an initial emitted template', async () => {
    await rm(outputPath)
    const update = vi.fn(async () => {})
    await expect(measureFileMarkerUpdate({ outputPath, marker, update, timeoutMs: 50 }))
      .rejects
      .toMatchObject({ code: 'ENOENT' })
    expect(update).not.toHaveBeenCalled()
  })

  it('accepts an atomic replacement after a temporary missing file', async () => {
    let pendingWrite: Promise<void> | undefined
    try {
      await expect(measureFileMarkerUpdate({
        outputPath,
        marker,
        timeoutMs: 2_000,
        update: async () => {
          await rm(outputPath)
          pendingWrite = setTimeout(30).then(() => writeFile(outputPath, `<view>${marker}</view>`))
        },
      })).resolves.toBeGreaterThan(0)
    }
    finally {
      await pendingWrite
    }
  })

  it('preserves read failures instead of treating them as missing output', async () => {
    await expect(measureFileMarkerUpdate({
      outputPath,
      marker,
      timeoutMs: 2_000,
      update: async () => {
        await rm(outputPath)
        await mkdir(outputPath)
      },
    })).rejects.toMatchObject({ code: 'EISDIR' })
  })

  it('preserves source update errors', async () => {
    const failure = new Error('source update failed')
    await expect(measureFileMarkerUpdate({
      outputPath,
      marker,
      timeoutMs: 50,
      update: async () => { throw failure },
    })).rejects.toBe(failure)
  })

  it('rejects a marker emitted after the deadline', async () => {
    await expect(measureFileMarkerUpdate({
      outputPath,
      marker,
      timeoutMs: 10,
      update: async () => {
        await setTimeout(30)
        await writeFile(outputPath, `<view>${marker}</view>`)
      },
    })).rejects.toThrow('Timed out waiting for emitted HMR marker')
  })

  it('stops polling when the dev process fails', async () => {
    const abort = new AbortController()
    const failure = new Error('dev process exited')
    await expect(measureFileMarkerUpdate({
      outputPath,
      marker,
      timeoutMs: 2_000,
      signal: abort.signal,
      update: async () => { abort.abort(failure) },
    })).rejects.toBe(failure)
  })

  it('cancels an active polling timer on process failure', async () => {
    const abort = new AbortController()
    let pendingAbort: Promise<void> | undefined
    try {
      await expect(measureFileMarkerUpdate({
        outputPath,
        marker,
        timeoutMs: 2_000,
        signal: abort.signal,
        update: async () => {
          pendingAbort = setTimeout(30).then(() => {
            abort.abort()
          })
        },
      })).rejects.toMatchObject({ name: 'AbortError' })
    }
    finally {
      await pendingAbort
    }
  })
})
