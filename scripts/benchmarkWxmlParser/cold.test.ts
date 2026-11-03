import type { Fixture } from './types'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { exec } from 'tinyexec'
import { describe, expect, it, vi } from 'vitest'
import { measureCold } from './cold'
import { RAW_XML_PARSE_OPTIONS } from './parserContract'
import { NODE_STACK_ARGUMENT } from './runtime'

vi.mock('tinyexec', () => ({ exec: vi.fn() }))

describe('cold parser failure evidence', () => {
  it('records a failed child cell, keeps later cells and passes the fixed budget to both arms', async () => {
    const output = await mkdtemp(path.join(os.tmpdir(), 'wxml-cold-test-'))
    const fixture: Fixture = { id: 'real', sha256: 'hash', bytes: 7, origins: ['fixture.wxml'], source: '<view/>', platform: 'weapp', cohort: 'shared', size: 'small' }
    vi.mocked(exec).mockRejectedValueOnce(new RangeError('worker stack exhaustion'))
    vi.mocked(exec).mockResolvedValue({ stdout: JSON.stringify({ durationMs: 1, importMs: 1, memoryBefore: {}, memoryAfter: {}, peakRssBytes: 1, execArgv: [NODE_STACK_ARGUMENT] }) } as Awaited<ReturnType<typeof exec>>)
    try {
      const report = await measureCold({ baseline: 'baseline.mjs', candidate: 'candidate.mjs' }, [fixture], output, true, async () => {})
      expect(report.errors).toMatchObject([{ operation: 'cold-first-parse', cohort: 'shared', arm: 'baseline', phase: 'primary', round: 0 }])
      expect(report.summaries).toHaveLength(3)
      expect(report.summaries[1]!.status).toBe('informational')
      expect(report.samples).toHaveLength(4)
      expect(vi.mocked(exec).mock.calls.every(([, args]) => args?.[0] === NODE_STACK_ARGUMENT)).toBe(true)
      expect(report.samples.every(sample => sample.execArgv.includes(NODE_STACK_ARGUMENT))).toBe(true)
      expect(report.baselineParseOptions).toEqual(RAW_XML_PARSE_OPTIONS)
      for (const arm of ['baseline', 'candidate']) {
        const request = JSON.parse(await readFile(path.join(output, `cold-shared-${arm}.json`), 'utf8')) as { baselineParseOptions: typeof RAW_XML_PARSE_OPTIONS }
        expect(request.baselineParseOptions).toEqual({ xmlMode: true, decodeEntities: false, recognizeSelfClosing: true, withStartIndices: true, withEndIndices: true })
      }
    }
    finally {
      await rm(output, { recursive: true, force: true })
      vi.mocked(exec).mockReset()
    }
  })

  it('forwards raw XML options to the native cold worker parser boundary', async () => {
    const output = await mkdtemp(path.join(os.tmpdir(), 'wxml-cold-options-test-'))
    try {
      const entry = path.join(output, 'stub.mjs')
      await writeFile(entry, `export function parseDocument(source, options) {
        if (options.xmlMode !== true || options.decodeEntities !== false || options.recognizeSelfClosing !== true || options.withStartIndices !== true || options.withEndIndices !== true) {
          throw new Error('Cold worker changed the raw tree contract.')
        }
        return { source }
      }`)
      const request = path.join(output, 'request.json')
      await writeFile(request, JSON.stringify({ entry, fixtures: [{ id: 'stub', source: '<view/>' }], arm: 'baseline', baselineParseOptions: RAW_XML_PARSE_OPTIONS }))
      const { stdout } = await promisify(execFile)(process.execPath, [NODE_STACK_ARGUMENT, fileURLToPath(new URL('./coldWorker.mjs', import.meta.url)), request])
      const result = JSON.parse(stdout) as { error?: string, execArgv: string[] }
      expect(result.error).toBeUndefined()
      expect(result.execArgv).toContain(NODE_STACK_ARGUMENT)
    }
    finally {
      await rm(output, { recursive: true, force: true })
    }
  })
})
