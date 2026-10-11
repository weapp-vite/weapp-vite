import type { ManagedWechatProjectRecord, ManagedWechatWindowLogCursor } from '../types'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { inspect } from 'node:util'
import { captureManagedWindowClose, waitForManagedWindowClosed } from '../windowClose'

export const legacyInventoryFailure = 'Managed DevTools window-close log set changed; host generation or log rotation is unresolved.'

export interface WindowCloseFixture {
  directory: string
  logDirectory: string
  logFile: string
  record: ManagedWechatProjectRecord
  line: (message: string, source?: string, version?: string) => string
  boot: (version?: string) => string
  trace: (event: string, fields: Record<string, unknown>, version?: string) => string
  call: (winId?: string, browserWindowId?: number, forceClose?: boolean) => string
  request: (projectId?: string, winId?: string, runtimeId?: string) => string
  closed: (winId?: string) => string
  destroyed: (winId?: string, browserWindowId?: number) => string
  capture: () => Promise<void>
  wait: (persist?: () => Promise<void>) => Promise<void>
  dispose: () => Promise<void>
}

/** 按旧版持久化格式构造游标，用于验证旧日志记录的迁移边界。 */
export async function snapshotLegacyCursor(file: string): Promise<ManagedWechatWindowLogCursor> {
  const [stat, bytes] = await Promise.all([fs.stat(file, { bigint: true }), fs.readFile(file)])
  return {
    name: path.basename(file),
    identity: `${stat.dev}:${stat.ino}`,
    offset: bytes.length,
    anchor: createHash('sha256').update(bytes.subarray(Math.max(0, bytes.length - 256))).digest('hex'),
    skipPartialLine: bytes.length > 0 && bytes.at(-1) !== 10,
  }
}

export async function createWindowCloseFixture(): Promise<WindowCloseFixture> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'managed-window-close-'))
  const profileDir = path.join(directory, 'selected-profile')
  const logDirectory = path.join(profileDir, 'WeappLog', 'logs')
  const logFile = path.join(logDirectory, 'current.log')
  const now = new Date().toISOString()
  let sequence = 1
  const record: ManagedWechatProjectRecord = {
    schemaVersion: 1,
    id: randomUUID(),
    generation: 'test-generation',
    journalPath: path.join(directory, 'journal'),
    ownerToken: randomUUID(),
    ownerPid: process.pid,
    target: { cliPath: path.join(directory, 'cli'), appPath: path.join(directory, 'app'), installationId: 'selected', version: '2.02.2608070', profileDir },
    projectPath: path.join(directory, 'project'),
    state: 'closing',
    openedProjectWindow: true,
    createdAt: now,
    updatedAt: now,
  }
  const fixture: WindowCloseFixture = {
    directory,
    logDirectory,
    logFile,
    record,
    line(message: string, source = 'MAIN', version = fixture.record.target.version) {
      const timestamp = new Date(Date.now() + sequence++).toISOString().replace('T', ' ').replace('Z', '+00:00')
      return `[${timestamp}][INFO][${version}][${source}][vendor-source] ${message}\n`
    },
    boot(version = fixture.record.target.version) {
      return fixture.line('envMessagerService setuped', 'MAIN', version)
    },
    trace(event: string, fields: Record<string, unknown>, version = fixture.record.target.version) {
      return fixture.line(`[win-close-trace] ${event} ${inspect(fields, { breakLength: Infinity, compact: true })}`, 'MAIN', version)
    },
    call(winId = 's1', browserWindowId = 3, forceClose = false) {
      return fixture.trace('native-close-call', { winId, forceClose, browserWindowId, destroyed: false, bounds: { x: 0, y: 0 } })
    },
    request(projectId = fixture.record.projectPath, winId = 's1', runtimeId = '0') {
      return fixture.trace('close-requested', { winId, status: 'opened', windowType: 'project', projectId, runtimeId, nativeState: { visible: true } })
    },
    closed(winId = 's1') {
      return fixture.trace('native-window-closed', { winId, state: { visible: undefined }, wasClosing: true })
    },
    destroyed(winId = 's1', browserWindowId = 3) {
      return fixture.trace('webcontents-destroyed', { winId, browserWindowId, destroyed: true })
    },
    async capture() {
      fixture.record.windowClose = await captureManagedWindowClose(fixture.record)
      fixture.record.windowClose.dispatchedAt = new Date().toISOString()
    },
    async wait(persist = async () => {}) {
      await waitForManagedWindowClosed(fixture.record, persist, { timeoutMs: 0 })
    },
    async dispose() {
      await fs.rm(directory, { recursive: true, force: true })
    },
  }
  await fs.mkdir(logDirectory, { recursive: true })
  await fs.writeFile(logFile, fixture.boot())
  return fixture
}
