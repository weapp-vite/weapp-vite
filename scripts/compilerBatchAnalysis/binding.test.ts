import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDiagnosticBinding } from './binding'

describe('independent compiler binding diagnostic', () => {
  it('forwards the exact batch and preserves other exports, with a single-call fault mode', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'compiler-binding-'))
    try {
      const nativePath = path.join(directory, 'binding.cjs')
      await writeFile(nativePath, 'module.exports = { marker: 7, analyzeCompilerScriptsNative: inputs => inputs.map(input => ({ source: input.code })) }')
      for (const fault of [false, true]) {
        const file = path.join(directory, `diagnostic-${fault}.cjs`)
        await createDiagnosticBinding(nativePath, file, fault)
        const binding = createRequire(import.meta.url)(file) as {
          marker: number
          analyzeCompilerScriptsNative: (inputs: Array<{ code: string }>) => unknown
          getCompilerBatchDiagnosticCounts: () => { calls: number, scripts: number }
        }
        expect(binding.marker).toBe(7)
        expect(binding.getCompilerBatchDiagnosticCounts()).toEqual({ calls: 0, scripts: 0 })
        const inputs = [{ code: 'first' }, { code: 'second' }]
        if (fault) {
          expect(() => binding.analyzeCompilerScriptsNative(inputs)).toThrow('Injected compiler batch failure')
        }
        else {
          expect(binding.analyzeCompilerScriptsNative(inputs)).toEqual([{ source: 'first' }, { source: 'second' }])
        }
        expect(binding.getCompilerBatchDiagnosticCounts()).toEqual({ calls: 1, scripts: 2 })
      }
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
