import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { captureArtifacts, warningEvidence } from './artifacts'
import { readNativeTrace, verifyNativeBinding } from './native'

describe('native benchmark evidence', () => {
  it('compares source map content and requires executable outputs', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'native-artifacts-'))
    try {
      await expect(captureArtifacts(root)).rejects.toThrow('Missing executable')
      await writeFile(path.join(root, 'app.json'), JSON.stringify({ pages: ['pages/index'], window: {} }))
      await writeFile(path.join(root, 'app.js'), 'console.log(1)')
      await writeFile(path.join(root, 'app.js.map'), JSON.stringify({ version: 3, sources: [`${root}/src/app.ts`], mappings: 'AAAA' }))
      const first = await captureArtifacts(root, [root])
      expect(first.maps).toBe(1)
      await writeFile(path.join(root, 'app.json'), '{"window":{},"pages":["pages/index"]}')
      expect((await captureArtifacts(root, [root])).digest).toBe(first.digest)
      await writeFile(path.join(root, 'app.js.map'), JSON.stringify({ version: 3, sources: [`${root}/src/app.ts`], mappings: 'AACA' }))
      expect((await captureArtifacts(root, [root])).digest).not.toBe(first.digest)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('preserves diagnostic wording and multiline details', () => {
    expect(warningEvidence('build started\nWarning: unsupported option\n  at source:1\nbuild done\n')).toEqual(['Warning: unsupported option\n  at source:1'])
    expect(warningEvidence('Warning: changed option')).not.toEqual(warningEvidence('Warning: unsupported option'))
  })

  it('rejects missing bindings and duplicate native process evidence', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'native-diagnostics-'))
    try {
      await expect(verifyNativeBinding(path.join(root, 'missing.node'))).rejects.toThrow()
      const trace = path.join(root, 'trace.jsonl')
      expect(await readNativeTrace(trace)).toEqual({ calls: 0, failures: 0, inputs: 0, inputBytes: 0, processes: 0 })
      await writeFile(trace, `${JSON.stringify({ pid: 1, calls: 3, failures: 1, inputs: 6, inputBytes: 64 })}\n`)
      expect(await readNativeTrace(trace)).toEqual({ calls: 3, failures: 1, inputs: 6, inputBytes: 64, processes: 1 })
      await writeFile(trace, [1, 1].map(pid => JSON.stringify({ pid, calls: 1, failures: 0, inputs: 1, inputBytes: 32 })).join('\n'))
      await expect(readNativeTrace(trace)).rejects.toThrow('duplicate')
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
