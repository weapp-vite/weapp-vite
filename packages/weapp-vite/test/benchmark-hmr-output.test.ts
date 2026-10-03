import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { measureStatefulTemplateArtifact } from '../../../scripts/workspace-hmr/statefulArtifactMeasurement'
import { StatefulHmrAuditClient } from '../../../scripts/workspace-hmr/statefulAuditClient'
import { HmrDeliveryCoordinator } from '../../hmr/src/deliveryCoordinator'
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

  it('consumes an older pending batch while waiting for the next template marker', async () => {
    const previousPublished = Promise.withResolvers<void>()
    const executions = [Promise.withResolvers<void>(), Promise.withResolvers<void>()]
    const errors = vi.fn()
    const requests: string[] = []
    let nextPublished = Promise.withResolvers<void>()
    let publishedVersion = 0
    const queue = new HmrDeliveryCoordinator(errors)
    const enqueue = (version: number, output: string) => {
      queue.enqueue({ prepare: async () => ({
        commit: () => writeFile(outputPath, output),
        publish: async () => {
          publishedVersion = version
          nextPublished.resolve()
          nextPublished = Promise.withResolvers<void>()
          if (version === 1) {
            previousPublished.resolve()
          }
          await executions[version - 1]!.promise
        },
      }) })
    }
    const client = new StatefulHmrAuditClient(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { action: string, version: number }
      requests.push(`${body.action}:${body.version}`)
      if (body.action === 'register') {
        return new Response(JSON.stringify({ type: 'registered', acknowledgement: 'explicit-v1' }))
      }
      if (body.action === 'ack') {
        executions[body.version - 1]!.resolve()
        return new Response(JSON.stringify({ type: 'acknowledged', version: body.version }))
      }
      if (body.version >= publishedVersion) {
        await nextPublished.promise
      }
      return new Response(JSON.stringify({ type: 'batch-published', targetVersion: publishedVersion }))
    })
    const readControl = async () => ({ buildId: 'build', token: 'test-token', url: 'http://localhost/control' })
    await client.ensureRegistered(await readControl(), 200)
    enqueue(1, '<view>previous-template-marker</view>')
    await previousPublished.promise
    try {
      const measured = measureStatefulTemplateArtifact({
        client,
        readControl,
        isCurrentUpdate: async () => (await readFile(outputPath, 'utf8')).includes(marker),
        timeoutMs: 200,
        measure: signal => measureFileMarkerUpdate({
          outputPath,
          marker,
          timeoutMs: 200,
          signal,
          update: async () => { enqueue(2, `<view>${marker}</view>`) },
        }),
      })
      await expect(measured).resolves.toBeGreaterThan(0)
      expect(requests).toContain('ack:1')
      expect(requests).toContain('ack:2')
      expect(errors).not.toHaveBeenCalled()
    }
    finally {
      executions.forEach(execution => execution.resolve())
      await queue.close()
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

  it('requires byte-for-byte restored output instead of just an absent marker', async () => {
    const expectedOutput = await readFile(outputPath, 'utf8')
    await writeFile(outputPath, `<view>${marker}</view>`)
    await expect(measureFileMarkerUpdate({
      outputPath,
      marker,
      expectedOutput,
      timeoutMs: 50,
      update: () => writeFile(outputPath, '<view>unrelated output</view>'),
    })).rejects.toThrow('Timed out')
    await expect(measureFileMarkerUpdate({
      outputPath,
      marker,
      expectedOutput,
      timeoutMs: 2000,
      update: () => writeFile(outputPath, expectedOutput),
    })).resolves.toBeGreaterThan(0)
    const update = vi.fn(async () => {})
    await expect(measureFileMarkerUpdate({ outputPath, marker, expectedOutput, update, timeoutMs: 50 })).rejects.toThrow('already restored')
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
