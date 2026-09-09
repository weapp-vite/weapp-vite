import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { collectHmrFailureDiagnostics, enrichHmrFailure } from './hmr-failure-diagnostics'

const roots: string[] = []

describe('HMR failure evidence', () => {
  afterEach(async () => {
    await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
  })

  it('distinguishes stale output, missing output and read errors without leaking paths', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'hmr-diagnostics-'))
    roots.push(root)
    const source = path.join(root, 'source.wxml')
    const output = path.join(root, 'output.wxml')
    const profile = path.join(root, 'profile.jsonl')
    await writeFile(source, '<view>UPDATED</view>')
    await writeFile(output, '<view>INITIAL</view>')
    await writeFile(profile, `${JSON.stringify({ file: source, eventId: 'current-event', totalMs: 10 })}\r\ninvalid-json\r\n`)
    const options = {
      files: [
        { label: 'source', path: source, marker: 'UPDATED' },
        { label: 'stale', path: output, marker: 'UPDATED' },
        { label: 'missing', path: path.join(root, 'missing.wxml'), marker: 'UPDATED' },
        { label: 'unreadable', path: root, marker: 'UPDATED' },
      ],
      profilePath: profile,
      devOutput: `compiled ${source}`,
    }
    const evidence = await collectHmrFailureDiagnostics(options)
    expect(evidence.files).toEqual([
      expect.objectContaining({ label: 'source', exists: true, containsMarker: true, sha256: createHash('sha256').update('<view>UPDATED</view>').digest('hex') }),
      expect.objectContaining({ label: 'stale', exists: true, containsMarker: false }),
      expect.objectContaining({ label: 'missing', exists: false }),
      expect.objectContaining({ label: 'unreadable', exists: null, readError: expect.any(String) }),
    ])
    expect(evidence.profile.recent).toEqual([
      expect.objectContaining({ sample: expect.objectContaining({ eventId: 'current-event' }), matchingFiles: ['source'] }),
      expect.objectContaining({ raw: 'invalid-json', parseError: expect.any(String) }),
    ])
    expect(JSON.stringify(evidence)).not.toContain(root.replaceAll('\\', '/'))
    const failure = await enrichHmrFailure(new Error(`Timed out at ${source}`), options)
    expect(failure.message).toContain('Timed out')
    expect(failure.message).toContain('captured before source restoration')
    expect(failure.message).not.toContain(root.replaceAll('\\', '/'))
  })
})
