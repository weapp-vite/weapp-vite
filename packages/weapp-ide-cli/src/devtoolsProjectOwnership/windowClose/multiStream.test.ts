import type { ManagedWechatProjectRecord } from '../types'
import type { WindowCloseFixture } from './fixture'
import fs from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWindowCloseFixture, snapshotLegacyCursor } from './fixture'
import { managedWindowCloseSchema } from './schema'

let fixture: WindowCloseFixture
let otherLog: string

beforeEach(async () => {
  fixture = await createWindowCloseFixture()
  otherLog = path.join(fixture.logDirectory, 'other-main-transport.log')
  await fs.writeFile(otherLog, '')
  await fixture.capture()
  // 模拟已核验主进程的两份固定日志；文件描述符归属由 activeLog 测试单独覆盖。
  fixture.record.windowClose!.cursors.push(await snapshotLegacyCursor(otherLog))
})

afterEach(async () => {
  await fixture.dispose()
})

describe('fixed main-process log streams', () => {
  it.each(['initial', 'initially-empty'] as const)('accepts complete destruction evidence entirely in the %s stream', async (stream) => {
    const log = stream === 'initial' ? fixture.logFile : otherLog
    await fs.appendFile(log, fixture.call() + fixture.request() + fixture.closed() + fixture.destroyed())

    await fixture.wait()

    const expected = fixture.record.windowClose!.cursors.find(cursor => cursor.name === path.basename(log))!
    expect(fixture.record.windowClose!.window).toMatchObject({
      fileIdentity: expected.identity,
      winId: 's1',
      browserWindowId: 3,
      nativeClosedAt: expect.any(String),
      webContentsDestroyedAt: expect.any(String),
    })
    expect(fixture.record.windowClose!.cursors).toHaveLength(2)
  })

  it.each(['native', 'webcontents', 'both'] as const)('never joins %s destruction from a different file to the exact request', async (split) => {
    const prefix = fixture.call() + fixture.request()
    const native = fixture.closed()
    const webcontents = fixture.destroyed()
    await fs.appendFile(fixture.logFile, prefix
    + (split === 'native' ? webcontents : split === 'webcontents' ? native : ''))
    await fs.appendFile(otherLog, split === 'native' ? native : split === 'webcontents' ? webcontents : native + webcontents)

    await expect(fixture.wait()).rejects.toThrow('no complete native-window destruction evidence')
  })

  it.each([false, true])('rejects another exact project request even after a complete first stream (large backlog: %s)', async (backlog) => {
    await fs.appendFile(fixture.logFile, fixture.call() + fixture.request() + fixture.closed() + fixture.destroyed())
    const unrelated = backlog ? 'unrelated diagnostic entry\n'.repeat(150_000) : ''
    await fs.appendFile(otherLog, unrelated + fixture.call('s2', 4) + fixture.request(fixture.record.projectPath, 's2', '1'))

    await expect(fixture.wait()).rejects.toThrow('ambiguous window identity')
    expect(fixture.record.windowClose!.failure).toContain('ambiguous window identity')
  })

  it('resumes the same serialized cursors without replaying the close request', async () => {
    await fs.appendFile(otherLog, fixture.call() + fixture.request())
    let saved = ''
    await expect(fixture.wait(async () => {
      saved = JSON.stringify(fixture.record)
    })).rejects.toThrow('no complete native-window destruction evidence')
    const restored = JSON.parse(saved) as ManagedWechatProjectRecord
    expect(managedWindowCloseSchema.parse(restored.windowClose).cursors).toHaveLength(2)

    fixture.record = restored
    await fs.appendFile(otherLog, fixture.closed() + fixture.destroyed())
    await fixture.wait()

    expect(fixture.record.windowClose!.calls).toHaveLength(1)
    expect(fixture.record.windowClose!.window?.webContentsDestroyedAt).toEqual(expect.any(String))
  })
})
