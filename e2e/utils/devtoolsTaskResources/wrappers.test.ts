import type { WrapperResourceEvent } from './types'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseWrapperResourceEvents, recordWrapperResourceEvent, summarizeWrapperResources, TASK_RESOURCE_EVENT_ERROR_MARKER, TASK_RESOURCE_EVENTS_ENV } from './wrappers'

let directory: string
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'task-wrapper-resources-'))
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  fs.rmSync(directory, { recursive: true, force: true })
})

const event = (type: WrapperResourceEvent['type'], watcherId?: string): WrapperResourceEvent => ({ type, watcherId, wrapperRoot: 'owned-snapshot', pid: 1, at: new Date().toISOString() })

describe('instrumented bridge wrapper resources', () => {
  it('requires explicit watcher stop and snapshot deletion events', () => {
    const events = [event('snapshot-created'), event('watcher-started', 'watcher-one')]
    expect(summarizeWrapperResources(events).gaps).toEqual([
      expect.stringContaining('No explicit watcher stop'),
      expect.stringContaining('No snapshot deletion'),
    ])
    expect(summarizeWrapperResources([...events, event('watcher-stopped', 'watcher-one'), event('snapshot-deleted')]).gaps).toEqual([])
  })

  it('detects truncated lifecycle history and missing watcher identities', () => {
    expect(summarizeWrapperResources([event('snapshot-deleted')]).gaps).toEqual([expect.stringContaining('no recorded creation')])
    expect(summarizeWrapperResources([event('watcher-stopped', 'unknown')]).gaps).toEqual([expect.stringContaining('no recorded start')])
    expect(() => parseWrapperResourceEvents(JSON.stringify(event('watcher-started')))).toThrow('invalid record')
    expect(() => parseWrapperResourceEvents('{')).toThrow()
  })

  it('retains watcher and snapshot cleanup errors even when later cleanup records succeed', () => {
    const events = [event('snapshot-created'), event('watcher-started', 'one'), { ...event('watcher-stop-error', 'one'), error: 'close failed' }, event('watcher-stopped', 'one'), { ...event('snapshot-delete-error'), error: 'delete failed' }, event('snapshot-deleted')]
    expect(summarizeWrapperResources(events).gaps).toEqual(['watcher-stop-error: close failed', 'snapshot-delete-error: delete failed'])
  })

  it('only appends to the parent-initialized file and does not recreate a deleted event stream', () => {
    const file = path.join(directory, 'events.jsonl')
    vi.stubEnv(TASK_RESOURCE_EVENTS_ENV, file)
    const error = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    recordWrapperResourceEvent('snapshot-created', 'owned-snapshot')
    expect(fs.existsSync(file)).toBe(false)
    expect(error).toHaveBeenCalledWith(expect.stringContaining(TASK_RESOURCE_EVENT_ERROR_MARKER))

    fs.writeFileSync(file, '')
    recordWrapperResourceEvent('snapshot-created', 'owned-snapshot')
    expect(parseWrapperResourceEvents(fs.readFileSync(file, 'utf8'))).toMatchObject([{ type: 'snapshot-created', wrapperRoot: 'owned-snapshot' }])
    fs.rmSync(file)
    recordWrapperResourceEvent('snapshot-deleted', 'owned-snapshot')
    expect(fs.existsSync(file)).toBe(false)
  })

  it('does not write events without an explicitly initialized parent path', () => {
    vi.stubEnv(TASK_RESOURCE_EVENTS_ENV, '')
    recordWrapperResourceEvent('snapshot-created', 'owned-snapshot')
    expect(fs.readdirSync(directory)).toEqual([])
  })
})
