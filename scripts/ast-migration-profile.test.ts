import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { compilerCases } from './astMigrationProfile/cases'
import { parseArguments } from './astMigrationProfile/index'

describe('real compiler profile public command', () => {
  it('retains a no-argument command with forty pairs and rejects ambiguous/underpowered sampling', () => {
    expect(parseArguments([]).trials).toBe(40)
    expect(() => parseArguments(['--trials=7'])).toThrow('at least 40')
    expect(() => parseArguments(['--trials=40', '--trials=41'])).toThrow('Duplicate')
    expect(() => parseArguments(['--synthetic'])).toThrow('Unknown')
  })

  it('keeps eight real unchanged sources, including the no-batch control', async () => {
    expect(compilerCases).toHaveLength(8)
    for (const fixture of compilerCases) {
      const source = await readFile(new URL(`../${fixture.project}/${fixture.file}`, import.meta.url), 'utf8')
      expect(source).toContain('<template>')
    }
    expect(compilerCases.find(fixture => fixture.id === 'script-import-control')?.expectCompilerBatch).toBe(false)
  })

  it('uses the built public entry and never reimplements internal compilation phases', async () => {
    const worker = await readFile(new URL('./astMigrationProfile/worker.ts', import.meta.url), 'utf8')
    expect(worker).toContain('\'packages-runtime/wevu-compiler/dist/index.mjs\'')
    expect(worker).toContain('measureRealEntry(compiler.compileVueFile')
    expect(worker).not.toMatch(/compileScriptPhase|compileTemplatePhase|parseVueFile|AST_FULL_CHAIN_SPEEDUP/)
  })
})
