import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMockBridgeSnapshotCleanup } from './snapshotCleanup'

let directory: string
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-bridge-snapshot-cleanup-'))
})
afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true })
})

describe('mock bridge snapshot cleanup', () => {
  const bridgePath = path.resolve(import.meta.dirname, '../../utils/automator.cli-bridge.ts')
  const call = (projectPath: string) => ['node', ['--import', 'tsx', bridgePath, JSON.stringify({ projectPath })]]

  it('only deletes registered new snapshots and remains idempotent', () => {
    const root = path.join(directory, 'snapshots')
    const existing = path.join(root, '1111111111111111')
    fs.mkdirSync(existing, { recursive: true })
    const cleanup = createMockBridgeSnapshotCleanup(root, bridgePath)
    const owned = path.join(root, '2222222222222222')
    const unregistered = path.join(root, '3333333333333333')
    fs.mkdirSync(owned)
    fs.mkdirSync(unregistered)

    const calls = [call(existing), call(owned), call(owned)]
    expect(cleanup(calls)).toEqual([owned])
    expect(fs.existsSync(owned)).toBe(false)
    expect(fs.existsSync(existing)).toBe(true)
    expect(fs.existsSync(unregistered)).toBe(true)
    expect(cleanup(calls)).toEqual([])
  })

  it('preserves unrecognized commands, paths, and symlink targets', () => {
    const root = path.join(directory, 'snapshots')
    const cleanup = createMockBridgeSnapshotCleanup(root, bridgePath)
    const target = path.join(directory, '4444444444444444')
    const symlink = path.join(root, '5555555555555555')
    const nested = path.join(root, 'nested', '6666666666666666')
    const unrecognized = path.join(root, '7777777777777777')
    fs.mkdirSync(target)
    fs.mkdirSync(nested, { recursive: true })
    fs.mkdirSync(unrecognized)
    fs.symlinkSync(target, symlink, process.platform === 'win32' ? 'junction' : 'dir')
    const calls = [
      call(target),
      call(symlink),
      call(nested),
      ['other-command', call(unrecognized)[1]],
      ['node', ['--import', 'tsx', 'other-bridge.ts', JSON.stringify({ projectPath: unrecognized })]],
      ['node', ['--import', 'tsx', bridgePath, '{}', JSON.stringify({ projectPath: unrecognized })]],
      ['node', ['--import', 'tsx', bridgePath, '{invalid json']],
    ]

    expect(cleanup(calls)).toEqual([])
    for (const preserved of [target, symlink, nested, unrecognized]) {
      expect(fs.existsSync(preserved)).toBe(true)
    }
  })

  it('preserves snapshots when the baseline root is replaced', () => {
    const root = path.join(directory, 'snapshots')
    const cleanup = createMockBridgeSnapshotCleanup(root, bridgePath)
    fs.renameSync(root, path.join(directory, 'original-snapshots'))
    const unknown = path.join(root, '8888888888888888')
    fs.mkdirSync(unknown, { recursive: true })

    expect(() => cleanup([call(unknown)])).toThrow('root identity changed')
    expect(fs.existsSync(unknown)).toBe(true)
  })
})
