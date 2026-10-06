import type { WindowCloseFixture } from './fixture'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWindowCloseFixture, snapshotLegacyCursor } from './fixture'
import { consumeFreshLogLines } from './logCursor'

let fixture: WindowCloseFixture
let second: string

beforeEach(async () => {
  fixture = await createWindowCloseFixture()
  await fixture.capture()
  second = path.join(fixture.logDirectory, 'secondary.log')
  await fs.writeFile(second, '')
  fixture.record.windowClose!.cursors.push(await snapshotLegacyCursor(second))
})

afterEach(async () => fixture.dispose())

function completeTrace() {
  return fixture.call() + fixture.request() + fixture.closed() + fixture.destroyed()
}

describe('bounded complete observation of every fixed log stream', () => {
  it('consumes a benign backlog larger than one read before accepting the complete close', async () => {
    await fs.appendFile(fixture.logFile, completeTrace())
    await fs.appendFile(second, 'unrelated diagnostic entry\r\n'.repeat(150_000))
    await fixture.wait()
    expect(fixture.record.windowClose!.cursors[1]!.offset).toBe((await fs.stat(second)).size)
  })

  it('blocks success on an incomplete second close request and rejects it once completed', async () => {
    await fs.appendFile(fixture.logFile, completeTrace())
    const call = fixture.call('s2', 4)
    const request = fixture.request(fixture.record.projectPath, 's2', '1')
    await fs.appendFile(second, call + request.slice(0, -1))
    await expect(fixture.wait()).rejects.toThrow('no complete native-window destruction evidence')
    expect(fixture.record.windowClose!.failure).toBeUndefined()
    await fs.appendFile(second, '\n')
    await expect(fixture.wait()).rejects.toThrow('ambiguous window identity')
  })

  it('waits for a pre-existing partial line to finish without using it as fresh evidence', async () => {
    const call = fixture.call()
    await fs.writeFile(second, call.slice(0, -1))
    fixture.record.windowClose!.cursors[1] = await snapshotLegacyCursor(second)
    await fs.appendFile(fixture.logFile, completeTrace())
    await fs.appendFile(second, 'unfinished')
    await expect(fixture.wait()).rejects.toThrow('no complete native-window destruction evidence')
    await fs.appendFile(second, '\n')
    await fixture.wait()
    expect(fixture.record.windowClose!.calls).toHaveLength(1)
  })

  it('does not wait beyond the fixed observed end when the writer appends during consumption', async () => {
    await fs.appendFile(second, 'observed\n')
    const received: string[] = []
    const drained = await consumeFreshLogLines(fixture.logDirectory, fixture.record.windowClose!.cursors, ({ line }) => {
      received.push(line)
      fsSync.appendFileSync(second, 'next observation\n')
    })
    expect(drained).toBe(true)
    expect(received).toEqual(['observed'])
    expect(fixture.record.windowClose!.cursors[1]!.offset).toBe('observed\n'.length)
  })

  it.each(['short-read', 'truncated', 'replaced', 'removed', 'rewritten'] as const)('rejects a stream %s during consumption', async (kind) => {
    await fs.appendFile(second, kind === 'short-read' ? 'diagnostic entry\n'.repeat(150_000) : 'diagnostic entry\n')
    let changed = false
    await expect(consumeFreshLogLines(fixture.logDirectory, fixture.record.windowClose!.cursors, () => {
      if (changed) {
        return
      }
      changed = true
      if (kind === 'short-read' || kind === 'truncated') {
        fsSync.truncateSync(second, 0)
      }
      else if (kind === 'removed') {
        fsSync.unlinkSync(second)
      }
      else if (kind === 'replaced') {
        fsSync.renameSync(second, `${second}.old`)
        fsSync.writeFileSync(second, 'diagnostic entry\n')
      }
      else {
        fsSync.writeFileSync(second, 'diagnostic other\n')
      }
    })).rejects.toThrow(kind === 'short-read' ? 'became shorter' : undefined)
  })

  it('keeps an oversized line unresolved even when another stream has complete evidence', async () => {
    await fs.appendFile(fixture.logFile, completeTrace())
    await fs.appendFile(second, `${'x'.repeat(2 * 1024 * 1024)}\n`)
    await expect(fixture.wait()).rejects.toThrow('log line exceeds the supported evidence limit')
    expect(fixture.record.windowClose!.failure).toContain('log line exceeds')
  })

  it('rejects an excessive total backlog before consuming any partial success', async () => {
    await fs.appendFile(fixture.logFile, completeTrace())
    await fs.truncate(second, 32 * 1024 * 1024 + 1)
    await expect(fixture.wait()).rejects.toThrow('log backlog exceeds the supported evidence limit')
    expect(fixture.record.windowClose!.window).toBeUndefined()
  })
})
