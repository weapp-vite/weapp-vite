import type { StatefulHmrOutputFile } from './outputWriter'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStatefulHmrSnapshotDiagnostics } from './snapshotDiagnostics'

const directories: string[] = []
const digest = (source: string) => createHash('sha256').update(source).digest('hex')

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

function collect() {
  const events: Array<Record<string, any>> = []
  return {
    events,
    emit(line: string) {
      events.push(JSON.parse(line.slice('[stateful-hmr-snapshot] '.length)) as Record<string, unknown>)
    },
  }
}

describe('opt-in stateful snapshot diagnostics', () => {
  it('does not read, hash or emit anything without the exact opt-in value', () => {
    const read = vi.fn()
    const emit = vi.fn()
    for (const enabled of ['', '0', 'true']) {
      vi.stubEnv('WEAPP_VITE_STATEFUL_HMR_SNAPSHOT_TRACE', enabled)
      expect(createStatefulHmrSnapshotDiagnostics({ root: '.', outDir: 'dist', read, emit })).toBeUndefined()
    }
    expect(read).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it('correlates source, candidate, diff and real disk publication without writing generated output itself', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'snapshot-diagnostic-'))
    directories.push(root)
    const outDir = path.join(root, 'dist')
    await mkdir(outDir)
    const sourceFile = path.join(root, 'page.vue')
    const outputFile = path.join(outDir, 'page.wxss')
    await writeFile(sourceFile, '<style>.probe { color: blue }</style>')
    await writeFile(outputFile, 'red')
    const { events, emit } = collect()
    const trace = createStatefulHmrSnapshotDiagnostics({ root, outDir, enabled: '1', emit })!
    const before: StatefulHmrOutputFile[] = [{ type: 'asset', fileName: 'page.wxss', source: 'red' }]
    const after: StatefulHmrOutputFile[] = [{ type: 'asset', fileName: 'page.wxss', source: 'blue' }]
    trace.request('refresh', [sourceFile])
    await trace.batch({ files: ['page.vue'], mode: 'refresh', isSuperseded: () => false }, async (batchId) => {
      trace.snapshot(batchId, after, false)
      trace.diff(batchId, before, after, after, false)
      await trace.write({ kind: 'refresh', batchId }, after, async () => {
        // 只有被观察的原生写入动作拥有输出持久化；诊断自身只读。
        expect(await readFile(outputFile, 'utf8')).toBe('red')
        await writeFile(outputFile, 'blue')
      })
    })
    expect(events.find(item => item.stage === 'source-before')?.observations[0].sha256).toBe(digest('<style>.probe { color: blue }</style>'))
    const diff = events.find(item => item.stage === 'snapshot-diff')!
    expect(diff.previous[0].sha256).toBe(digest('red'))
    expect(diff.selected[0].sha256).toBe(digest('blue'))
    const start = events.find(item => item.stage === 'write-start')!
    const end = events.find(item => item.stage === 'write-end')!
    expect(start).toMatchObject({ batchId: 1, writerId: 1, kind: 'refresh' })
    expect(start.disk[0].sha256).toBe(digest('red'))
    expect(end).toMatchObject({ batchId: 1, writerId: 1, status: 'resolved' })
    expect(end.disk[0]).toMatchObject({ file: 'dist/page.wxss', sha256: digest('blue') })
    expect(events.map(item => item.sequence)).toEqual(events.map((_, index) => index + 1))
    expect(new Set(events.map(item => item.sessionId)).size).toBe(1)
    expect(JSON.stringify(events)).not.toContain(root)
  })

  it('redacts Windows/external paths, source reasons and read errors while retaining superseded evidence', async () => {
    const { events, emit } = collect()
    const trace = createStatefulHmrSnapshotDiagnostics({
      root: 'C:\\private\\repo',
      outDir: 'C:\\private\\repo\\dist',
      enabled: '1',
      emit,
      read: async () => { throw Object.assign(new Error('secret C:\\private\\cache'), { code: 'ENOENT' }) },
    })!
    trace.source('C:\\private\\repo\\src\\page.vue', ['entry-style-only:1', 'C:\\private\\cache'])
    trace.request('refresh', ['src/page.vue'])
    trace.snapshot(1, [{ type: 'asset', fileName: 'page.wxss', source: 'blue' }], false)
    await trace.batch({ files: ['C:\\private\\repo\\src\\page.vue', 'C:\\private\\outside.vue'], mode: 'full', isSuperseded: () => true }, async (batchId) => {
      trace.discarded(batchId, 'after-build')
    })
    expect(events[0]).toMatchObject({ file: 'src/page.vue', reasons: ['entry-style-only:1', '<redacted>'] })
    expect(events.find(item => item.stage === 'request')).toMatchObject({ files: ['src/page.vue'] })
    expect(events.find(item => item.stage === 'snapshot-ready')?.assets[0]).toMatchObject({ file: 'dist/page.wxss', sha256: digest('blue') })
    expect(events.find(item => item.stage === 'source-before')?.observations).toEqual([
      { file: 'src/page.vue', error: 'ENOENT' },
      { file: '<external>', error: 'ENOENT' },
    ])
    expect(events.find(item => item.stage === 'batch-end')).toMatchObject({ superseded: true, status: 'resolved' })
    expect(JSON.stringify(events)).not.toMatch(/private|secret/)
  })

  it('reports writer failure with unchanged disk and preserves the exact original rejection', async () => {
    const { events, emit } = collect()
    const error = Object.assign(new Error('private output path'), { code: 'EACCES' })
    const trace = createStatefulHmrSnapshotDiagnostics({ root: '/repo', outDir: '/repo/dist', enabled: '1', emit, read: async () => Buffer.from('old') })!
    await expect(trace.batch({ files: [], mode: 'refresh', isSuperseded: () => false }, async (batchId) => {
      await trace.write({ kind: 'refresh', batchId }, [{ type: 'asset', fileName: 'page.wxss', source: 'new' }], async () => {
        throw error
      })
    })).rejects.toBe(error)
    expect(events.find(item => item.stage === 'write-end')).toMatchObject({ status: 'rejected', error: 'EACCES', disk: [{ sha256: digest('old') }] })
    expect(events.find(item => item.stage === 'batch-end')).toMatchObject({ status: 'rejected', error: 'EACCES' })
    expect(JSON.stringify(events)).not.toContain('private output path')
  })

  it('does not let diagnostic sink failures change execution or error identity', async () => {
    const trace = createStatefulHmrSnapshotDiagnostics({
      root: '/repo',
      outDir: '/repo/dist',
      enabled: '1',
      emit: () => {
        throw new Error('broken sink')
      },
    })!
    const write = vi.fn(async () => {})
    await trace.write({ kind: 'control' }, [], write)
    expect(write).toHaveBeenCalledOnce()
    const original = new Error('original failure')
    await expect(trace.write({ kind: 'delta' }, [], async () => {
      throw original
    })).rejects.toBe(original)
  })
})
