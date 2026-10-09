import type { ManagedWechatProjectRecord } from './types'
import type { WindowCloseFixture } from './windowClose/fixture'
import fs from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWindowCloseFixture } from './windowClose/fixture'
import { managedWindowCloseSchema } from './windowClose/schema'

let fixture: WindowCloseFixture

beforeEach(async () => {
  fixture = await createWindowCloseFixture()
})

afterEach(async () => {
  await fixture.dispose()
})

describe('managed native-window destruction evidence', () => {
  it('requires both native close and webcontents destruction after the exact fresh project request', async () => {
    await fixture.capture()
    await fs.appendFile(fixture.logFile, fixture.call() + fixture.request() + fixture.call('s1', 3, true) + fixture.closed())
    await expect(fixture.wait()).rejects.toThrow('no complete native-window destruction evidence')
    expect(fixture.record.windowClose?.window).toMatchObject({ winId: 's1', browserWindowId: 3, runtimeId: '0', nativeClosedAt: expect.any(String) })
    await fs.appendFile(fixture.logFile, fixture.destroyed())
    await fixture.wait()
    expect(fixture.record.windowClose?.window?.webContentsDestroyedAt).toEqual(expect.any(String))
  })

  it('persists the exact cursor and identity so another process can resume without another close', async () => {
    await fixture.capture()
    await fs.appendFile(fixture.logFile, fixture.call() + fixture.request())
    let saved = ''
    const persist = vi.fn(async () => {
      saved = JSON.stringify(fixture.record)
    })
    await expect(fixture.wait(persist)).rejects.toThrow('no complete native-window destruction evidence')
    const persisted = JSON.parse(saved) as ManagedWechatProjectRecord
    expect(managedWindowCloseSchema.parse(persisted.windowClose).window).toMatchObject({ winId: 's1', browserWindowId: 3 })
    await fs.appendFile(fixture.logFile, fixture.closed() + fixture.destroyed())
    fixture.record = persisted
    await fixture.wait(persist)
    expect(fixture.record.windowClose?.calls).toHaveLength(1)
    expect(fixture.record.windowClose?.window?.nativeClosedAt).toEqual(expect.any(String))
  })

  it('ignores old events and another project in the selected profile', async () => {
    await fs.appendFile(fixture.logFile, fixture.call() + fixture.request() + fixture.closed() + fixture.destroyed())
    await fixture.capture()
    await fs.appendFile(fixture.logFile, fixture.call('s2', 4) + fixture.request(path.join(fixture.directory, 'manual-project'), 's2', '1') + fixture.closed('s2') + fixture.destroyed('s2', 4))
    await expect(fixture.wait()).rejects.toThrow('no complete native-window destruction evidence')
    expect(fixture.record.windowClose?.window).toBeUndefined()
  })

  it('never reads matching evidence from another selected installation profile', async () => {
    await fixture.capture()
    const otherLogs = path.join(fixture.directory, 'other-profile', 'WeappLog', 'logs')
    await fs.mkdir(otherLogs, { recursive: true })
    await fs.writeFile(path.join(otherLogs, 'current.log'), fixture.call() + fixture.request() + fixture.closed() + fixture.destroyed())
    await expect(fixture.wait()).rejects.toThrow('no complete native-window destruction evidence')
    expect(fixture.record.windowClose?.window).toBeUndefined()
  })

  it('handles quoted project names, CRLF and an incomplete append without interpreting log text', async () => {
    fixture.record.projectPath = path.join(fixture.directory, '项目 \'quoted\' { braces }, "double" `literal` ')
    await fixture.capture()
    const lines = (fixture.call() + fixture.request() + fixture.closed() + fixture.destroyed()).replaceAll('\n', '\r\n')
    const split = lines.indexOf('projectId:') + 10
    await fs.appendFile(fixture.logFile, lines.slice(0, split))
    await expect(fixture.wait()).rejects.toThrow('no complete native-window destruction evidence')
    await fs.appendFile(fixture.logFile, lines.slice(split))
    await fixture.wait()
  })

  it('discards a partial pre-existing line rather than claiming it belongs to this close', async () => {
    const initial = fixture.call()
    await fs.appendFile(fixture.logFile, initial.slice(0, -1))
    await fixture.capture()
    await fs.appendFile(fixture.logFile, `\n${fixture.request()}${fixture.closed()}${fixture.destroyed()}`)
    await expect(fixture.wait()).rejects.toThrow('ambiguous window identity')
  })

  it.each(['native', 'webcontents'] as const)('does not accept a lone %s destruction event', async (kind) => {
    await fixture.capture()
    await fs.appendFile(fixture.logFile, fixture.call() + fixture.request() + (kind === 'native' ? fixture.closed() : fixture.destroyed()))
    await expect(fixture.wait()).rejects.toThrow('no complete native-window destruction evidence')
  })

  it.each(['cancelled', 'reused-id', 'repeated-close', 'other-project', 'wrong-webcontents', 'wrong-version', 'duplicate-project'] as const)('retains a permanent blocker for %s evidence', async (kind) => {
    await fixture.capture()
    const prefix = fixture.call() + fixture.request()
    const invalid = {
      'cancelled': fixture.trace('native-window-close-cancelled', { winId: 's1', state: { visible: true } }),
      'reused-id': fixture.call('s1', 4, true),
      'repeated-close': fixture.call(),
      'other-project': fixture.request(path.join(fixture.directory, 'manual-project')),
      'wrong-webcontents': fixture.destroyed('s1', 4),
      'wrong-version': fixture.trace('native-window-closed', { winId: 's1', wasClosing: true }, 'different-version'),
      'duplicate-project': fixture.call('s2', 4) + fixture.request(fixture.record.projectPath, 's2', '1'),
    }[kind]
    await fs.appendFile(fixture.logFile, prefix + invalid + fixture.closed() + fixture.destroyed())
    await expect(fixture.wait()).rejects.toThrow()
    expect(fixture.record.windowClose?.failure).toEqual(expect.any(String))
    await fs.appendFile(fixture.logFile, fixture.closed() + fixture.destroyed())
    await expect(fixture.wait()).rejects.toThrow(fixture.record.windowClose!.failure)
  })

  it.each(['truncated', 'rewritten', 'replaced', 'rotated', 'missing'] as const)('does not recover %s logs by scanning another generation', async (kind) => {
    await fixture.capture()
    if (kind === 'truncated') {
      await fs.truncate(fixture.logFile, 0)
    }
    else if (kind === 'rewritten') {
      await fs.writeFile(fixture.logFile, `${'x'.repeat(100)}\n`)
    }
    else if (kind === 'replaced') {
      await fs.rename(fixture.logFile, `${fixture.logFile}.old`)
      await fs.writeFile(fixture.logFile, fixture.call() + fixture.request() + fixture.closed() + fixture.destroyed())
    }
    else if (kind === 'rotated') {
      await fs.rename(fixture.logFile, `${fixture.logFile}.old`)
      await fs.writeFile(path.join(fixture.logDirectory, 'new-session.log'), fixture.call() + fixture.request() + fixture.closed() + fixture.destroyed())
    }
    else {
      await fs.rm(fixture.logFile)
    }
    await expect(fixture.wait()).rejects.toThrow()
    expect(fixture.record.windowClose?.failure).toEqual(expect.any(String))
  })

  it('rejects missing selected logs before any close can be dispatched', async () => {
    await fs.rm(fixture.logDirectory, { recursive: true })
    await expect(fixture.capture()).rejects.toThrow()
    expect(fixture.record.windowClose).toBeUndefined()
  })

  it('rejects changed selected profile or product version during recovery', async () => {
    await fixture.capture()
    fixture.record.target.version = 'another-version'
    await expect(fixture.wait()).rejects.toThrow('no longer matches its selected installation')
  })
})
