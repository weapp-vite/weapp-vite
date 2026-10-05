import type { ManagedWechatProjectRecord } from './types'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { inspect } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureManagedWindowClose, waitForManagedWindowClosed } from './windowClose'
import { managedWindowCloseSchema } from './windowClose/schema'

let directory: string
let logDirectory: string
let logFile: string
let record: ManagedWechatProjectRecord
let sequence: number

function trace(event: string, fields: Record<string, unknown>, version = record.target.version) {
  const timestamp = new Date(Date.now() + sequence++).toISOString().replace('T', ' ').replace('Z', '+00:00')
  return `[${timestamp}][WARN][${version}][MAIN][vendor-source] [win-close-trace] ${event} ${inspect(fields, { breakLength: Infinity, compact: true })}\n`
}

function call(winId = 's1', browserWindowId = 3, forceClose = false) {
  return trace('native-close-call', { winId, forceClose, browserWindowId, destroyed: false, bounds: { x: 0, y: 0 } })
}

function request(projectId = record.projectPath, winId = 's1', runtimeId = '0') {
  return trace('close-requested', { winId, status: 'opened', windowType: 'project', projectId, runtimeId, nativeState: { visible: true } })
}

function closed(winId = 's1') {
  return trace('native-window-closed', { winId, state: { visible: undefined }, wasClosing: true })
}

function destroyed(winId = 's1', browserWindowId = 3) {
  return trace('webcontents-destroyed', { winId, browserWindowId, destroyed: true })
}

async function capture() {
  record.windowClose = await captureManagedWindowClose(record)
  record.windowClose.dispatchedAt = new Date().toISOString()
}

async function wait(persist = vi.fn(async () => {})) {
  await waitForManagedWindowClosed(record, persist, { timeoutMs: 0 })
  return persist
}

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'managed-window-close-'))
  const profileDir = path.join(directory, 'selected-profile')
  logDirectory = path.join(profileDir, 'WeappLog', 'logs')
  logFile = path.join(logDirectory, 'current.log')
  await fs.mkdir(logDirectory, { recursive: true })
  await fs.writeFile(logFile, 'existing main-process log\n')
  const now = new Date().toISOString()
  record = {
    schemaVersion: 1,
    id: randomUUID(),
    generation: 'test-generation',
    journalPath: path.join(directory, 'journal'),
    ownerToken: randomUUID(),
    ownerPid: 1,
    target: { cliPath: path.join(directory, 'cli'), appPath: path.join(directory, 'app'), installationId: 'selected', version: '2.02.2608070', profileDir },
    projectPath: path.join(directory, 'project'),
    state: 'closing',
    openedProjectWindow: true,
    createdAt: now,
    updatedAt: now,
  }
  sequence = 1
})

afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true })
})

describe('managed native-window destruction evidence', () => {
  it('requires both native close and webcontents destruction after the exact fresh project request', async () => {
    await capture()
    await fs.appendFile(logFile, call() + request() + call('s1', 3, true) + closed())
    await expect(wait()).rejects.toThrow('no complete native-window destruction evidence')
    expect(record.windowClose?.window).toMatchObject({ winId: 's1', browserWindowId: 3, runtimeId: '0', nativeClosedAt: expect.any(String) })
    await fs.appendFile(logFile, destroyed())
    await wait()
    expect(record.windowClose?.window?.webContentsDestroyedAt).toEqual(expect.any(String))
  })

  it('persists the exact cursor and identity so another process can resume without another close', async () => {
    await capture()
    await fs.appendFile(logFile, call() + request())
    let saved = ''
    const persist = vi.fn(async () => {
      saved = JSON.stringify(record)
    })
    await expect(wait(persist)).rejects.toThrow('no complete native-window destruction evidence')
    const persisted = JSON.parse(saved) as ManagedWechatProjectRecord
    expect(managedWindowCloseSchema.parse(persisted.windowClose).window).toMatchObject({ winId: 's1', browserWindowId: 3 })
    await fs.appendFile(logFile, closed() + destroyed())
    record = persisted
    await wait(persist)
    expect(record.windowClose?.calls).toHaveLength(1)
    expect(record.windowClose?.window?.nativeClosedAt).toEqual(expect.any(String))
  })

  it('ignores old events and another project in the selected profile', async () => {
    await fs.appendFile(logFile, call() + request() + closed() + destroyed())
    await capture()
    await fs.appendFile(logFile, call('s2', 4) + request(path.join(directory, 'manual-project'), 's2', '1') + closed('s2') + destroyed('s2', 4))
    await expect(wait()).rejects.toThrow('no complete native-window destruction evidence')
    expect(record.windowClose?.window).toBeUndefined()
  })

  it('never reads matching evidence from another selected installation profile', async () => {
    await capture()
    const otherLogs = path.join(directory, 'other-profile', 'WeappLog', 'logs')
    await fs.mkdir(otherLogs, { recursive: true })
    await fs.writeFile(path.join(otherLogs, 'current.log'), call() + request() + closed() + destroyed())
    await expect(wait()).rejects.toThrow('no complete native-window destruction evidence')
    expect(record.windowClose?.window).toBeUndefined()
  })

  it('handles quoted project names, CRLF and an incomplete append without interpreting log text', async () => {
    record.projectPath = path.join(directory, '项目 \'quoted\' { braces }, "double" `literal` ')
    await capture()
    const lines = (call() + request() + closed() + destroyed()).replaceAll('\n', '\r\n')
    const split = lines.indexOf('projectId:') + 10
    await fs.appendFile(logFile, lines.slice(0, split))
    await expect(wait()).rejects.toThrow('no complete native-window destruction evidence')
    await fs.appendFile(logFile, lines.slice(split))
    await wait()
  })

  it('discards a partial pre-existing line rather than claiming it belongs to this close', async () => {
    const initial = call()
    await fs.appendFile(logFile, initial.slice(0, -1))
    await capture()
    await fs.appendFile(logFile, `\n${request()}${closed()}${destroyed()}`)
    await expect(wait()).rejects.toThrow('ambiguous window identity')
  })

  it.each(['native', 'webcontents'] as const)('does not accept a lone %s destruction event', async (kind) => {
    await capture()
    await fs.appendFile(logFile, call() + request() + (kind === 'native' ? closed() : destroyed()))
    await expect(wait()).rejects.toThrow('no complete native-window destruction evidence')
  })

  it.each(['cancelled', 'reused-id', 'repeated-close', 'other-project', 'wrong-webcontents', 'wrong-version', 'duplicate-project'] as const)('retains a permanent blocker for %s evidence', async (kind) => {
    await capture()
    const prefix = call() + request()
    const invalid = {
      'cancelled': trace('native-window-close-cancelled', { winId: 's1', state: { visible: true } }),
      'reused-id': call('s1', 4, true),
      'repeated-close': call(),
      'other-project': request(path.join(directory, 'manual-project')),
      'wrong-webcontents': destroyed('s1', 4),
      'wrong-version': trace('native-window-closed', { winId: 's1', wasClosing: true }, 'different-version'),
      'duplicate-project': call('s2', 4) + request(record.projectPath, 's2', '1'),
    }[kind]
    await fs.appendFile(logFile, prefix + invalid + closed() + destroyed())
    await expect(wait()).rejects.toThrow()
    expect(record.windowClose?.failure).toEqual(expect.any(String))
    await fs.appendFile(logFile, closed() + destroyed())
    await expect(wait()).rejects.toThrow(record.windowClose!.failure)
  })

  it.each(['truncated', 'rewritten', 'replaced', 'rotated', 'missing'] as const)('does not recover %s logs by scanning another generation', async (kind) => {
    await capture()
    if (kind === 'truncated') {
      await fs.truncate(logFile, 0)
    }
    else if (kind === 'rewritten') {
      await fs.writeFile(logFile, `${'x'.repeat(100)}\n`)
    }
    else if (kind === 'replaced') {
      await fs.rename(logFile, `${logFile}.old`)
      await fs.writeFile(logFile, call() + request() + closed() + destroyed())
    }
    else if (kind === 'rotated') {
      await fs.writeFile(path.join(logDirectory, 'new-session.log'), call() + request() + closed() + destroyed())
    }
    else {
      await fs.rm(logFile)
    }
    await expect(wait()).rejects.toThrow()
    expect(record.windowClose?.failure).toEqual(expect.any(String))
  })

  it('rejects missing selected logs before any close can be dispatched', async () => {
    await fs.rm(logDirectory, { recursive: true })
    await expect(capture()).rejects.toThrow()
    expect(record.windowClose).toBeUndefined()
  })

  it('rejects changed selected profile or product version during recovery', async () => {
    await capture()
    record.target.version = 'another-version'
    await expect(wait()).rejects.toThrow('no longer matches its selected installation')
  })
})
