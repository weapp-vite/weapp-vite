import type { ManagedWechatProjectRecord, ResolvedWechatDevtoolsTarget } from 'weapp-ide-cli'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MANAGED_PROJECT_JOURNAL_ENV } from 'weapp-ide-cli'
import { assertPluginOpenEvidence, assertPluginOpenOwnerUnchanged, assertPluginOpenReleased, capturePluginOpenBaseline, readPluginOpenRecords } from './pluginOpenEvidence'

const readRecords = vi.hoisted(() => vi.fn())
vi.mock('weapp-ide-cli', async importOriginal => ({ ...await importOriginal<typeof import('weapp-ide-cli')>(), readManagedWechatProjectRecords: readRecords }))

const target: ResolvedWechatDevtoolsTarget = {
  installationId: 'fixture-stable',
  cliPath: path.resolve('fixture-installation/cli'),
  appPath: path.resolve('fixture-installation'),
  profileDir: path.resolve('fixture-profile'),
  channel: 'stable',
  version: 'fixture-version',
}
const source = path.resolve('fixture-project')
const expected = { sourceProjectPath: source, layout: 'source' as const, target, port: 58001 }

function record(snapshot = false): ManagedWechatProjectRecord {
  const id = randomUUID()
  const journalPath = path.resolve('fixture-journal/children/current')
  return {
    schemaVersion: 1,
    id,
    generation: randomUUID(),
    ownerToken: randomUUID(),
    ownerPid: process.pid,
    journalPath,
    target,
    projectPath: snapshot ? path.join(journalPath, 'snapshots', id) : source,
    state: 'owned',
    openedProjectWindow: true,
    port: expected.port,
    host: { pid: process.pid, executable: path.resolve('fixture-installation/backend'), started: 'fixture-start' },
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...(snapshot
      ? { snapshot: {
          protocol: 'wechat-devtools-project-snapshot-v1' as const,
          sourceProjectPath: source,
          token: randomUUID(),
          state: 'ready' as const,
          directoryIdentity: { dev: 'fixture-device', ino: 'fixture-directory' },
          dispatchedAt: new Date(0).toISOString(),
        } }
      : {}),
  }
}

afterEach(() => vi.unstubAllEnvs())

describe('plugin dev:open owner evidence', () => {
  it('requires the explicit task journal and delegates recursive child reads to its public API', async () => {
    vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, undefined)
    await expect(readPluginOpenRecords()).rejects.toThrow(/explicit managed project journal/)
    const opened = record(true)
    const rootJournal = path.resolve('fixture-journal')
    vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, rootJournal)
    readRecords.mockResolvedValue([opened])
    expect(await readPluginOpenRecords()).toEqual([opened])
    expect(readRecords).toHaveBeenCalledExactlyOnceWith(rootJournal)
  })

  it('accepts P and this generation W while binding the source alias connection to the owner port', () => {
    for (const snapshot of [false, true]) {
      const opened = record(snapshot)
      expect(assertPluginOpenEvidence([opened], [], { ...expected, layout: snapshot ? 'snapshot' : 'source' }, `ws://127.0.0.1:${opened.port}`)).toBe(opened)
    }
  })

  it('requires all prior owners and snapshots to be fully released', () => {
    const previous = record(true)
    expect(() => capturePluginOpenBaseline([previous])).toThrow(/unresolved/)
    previous.state = 'released'
    expect(() => capturePluginOpenBaseline([previous])).toThrow(/unresolved/)
    previous.snapshot!.state = 'removed'
    const baseline = capturePluginOpenBaseline([previous])
    const opened = record(true)
    expect(assertPluginOpenEvidence([previous, opened], baseline, { ...expected, layout: 'snapshot' })).toBe(opened)
    expect(() => assertPluginOpenEvidence([previous], baseline, { ...expected, layout: 'snapshot' })).toThrow(/exactly one fresh/)
  })

  it.each(['starting', 'unconfirmed', 'borrowed', 'failed', 'released'] as const)('rejects %s as proof of a newly opened window', (state) => {
    expect(() => assertPluginOpenEvidence([{ ...record(), state }], [], expected)).toThrow(/matching confirmed/)
  })

  it('rejects absent or ambiguous owners, including an extra released owner from a side effect', () => {
    expect(() => assertPluginOpenEvidence([], [], expected)).toThrow(/exactly one fresh/)
    expect(() => assertPluginOpenEvidence([record(), { ...record(), state: 'released' }], [], expected)).toThrow(/exactly one fresh/)
  })

  it('rejects borrowed receipts, different installation details, listener identity and ports', () => {
    for (const patch of [
      { openedProjectWindow: false },
      { host: undefined },
      { target: { ...target, installationId: 'another-installation' } },
      { target: { ...target, cliPath: path.resolve('another-installation/cli') } },
      { target: { ...target, profileDir: path.resolve('another-profile') } },
      { target: { ...target, version: 'another-version' } },
      { port: expected.port + 1 },
    ]) {
      expect(() => assertPluginOpenEvidence([{ ...record(), ...patch }], [], expected)).toThrow(/matching confirmed/)
    }
    for (const endpoint of [`ws://127.0.0.1:${expected.port + 1}`, `ws://localhost:${expected.port}`, `http://127.0.0.1:${expected.port}`]) {
      expect(() => assertPluginOpenEvidence([record()], [], expected, endpoint)).toThrow(/endpoint/)
    }
  })

  it('rejects stale or unbound W and cannot substitute W for default P', () => {
    const opened = record(true)
    expect(() => assertPluginOpenEvidence([opened], [], expected)).toThrow(/source plugin project/)
    for (const patch of [
      { snapshot: undefined },
      { snapshot: { ...opened.snapshot!, state: 'reserved' as const } },
      { snapshot: { ...opened.snapshot!, dispatchedAt: undefined } },
      { snapshot: { ...opened.snapshot!, sourceProjectPath: path.resolve('another-project') } },
      { projectPath: path.resolve('stale-wrapper') },
    ]) {
      expect(() => assertPluginOpenEvidence([{ ...opened, ...patch }], [], { ...expected, layout: 'snapshot' })).toThrow(/snapshot W/)
    }
  })

  it('permits timestamp updates while rejecting owner replacement during log connection', () => {
    const before = record(true)
    expect(() => assertPluginOpenOwnerUnchanged(before, { ...before, updatedAt: new Date().toISOString() })).not.toThrow()
    for (const after of [{ ...before, generation: randomUUID() }, { ...before, ownerToken: randomUUID() }, { ...before, projectPath: source }, { ...before, snapshot: { ...before.snapshot!, token: randomUUID() } }]) {
      expect(() => assertPluginOpenOwnerUnchanged(before, after)).toThrow(/owner changed/)
    }
  })

  it('requires exact owner, native double destruction and snapshot removal after close', () => {
    const opened = record(true)
    const released: ManagedWechatProjectRecord = {
      ...opened,
      state: 'released',
      releasedReason: 'project-closed',
      snapshot: { ...opened.snapshot!, state: 'removed' },
      windowClose: {
        protocol: 'wechat-devtools-window-close-trace-v1',
        profileDir: target.profileDir,
        productVersion: target.version!,
        capturedAt: new Date(0).toISOString(),
        cursors: [],
        calls: [],
        window: { fileIdentity: 'fixture-log', winId: 'fixture-window', browserWindowId: 1, calledAt: 'called', runtimeId: 'fixture-runtime', requestedAt: 'requested', nativeClosedAt: 'closed', webContentsDestroyedAt: 'destroyed' },
      },
    }
    expect(assertPluginOpenReleased([released], opened)).toBe(released)
    for (const after of [{ ...released, ownerToken: randomUUID() }, { ...released, windowClose: undefined }, { ...released, snapshot: opened.snapshot }, { ...released, releasedReason: 'borrowed' as const }]) {
      expect(() => assertPluginOpenReleased([after], opened)).toThrow(/release remains unconfirmed/)
    }
  })
})
