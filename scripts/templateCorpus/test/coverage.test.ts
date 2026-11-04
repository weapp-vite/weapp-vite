import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { auditCoverage } from '../coverage'

function fileCoverage(file: string, statementHits: number[], branchHits: number[] = [1, 1]) {
  const location = (line: number) => ({ start: { line, column: 0 }, end: { line, column: 8 } })
  return { path: file, statementMap: Object.fromEntries(statementHits.map((_, index) => [index, location(index + 1)])), s: Object.fromEntries(statementHits.map((hit, index) => [index, hit])), fnMap: { 0: { loc: location(1) } }, f: { 0: 1 }, branchMap: { 0: { locations: branchHits.map((_, index) => location(index + 1)) } }, b: { 0: branchHits } }
}

describe('strict raw coverage audit', () => {
  it('blocks rounded percentages, missing production files and ignore directives', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'template-coverage-'))
    try {
      const source = path.join(directory, 'module.ts')
      const report = path.join(directory, 'coverage.json')
      await writeFile(source, 'export const value = 1\n')
      await writeFile(path.join(directory, 'ignored.test.ts'), 'test source')
      await writeFile(report, JSON.stringify({ [source]: fileCoverage(source, [...Array.from<number>({ length: 1000 }).fill(1), 0]) }))
      const rounded = await auditCoverage(directory, report)
      expect(rounded.accepted).toBe(false)
      expect(rounded.totals.statements).toEqual({ covered: 1000, total: 1001 })
      expect(rounded.files[0]?.gaps[0]).toMatchObject({ metric: 'statements', line: 1001 })
      await writeFile(report, JSON.stringify({ [source]: fileCoverage(source, [1]) }))
      expect((await auditCoverage(directory, report)).accepted).toBe(true)
      await writeFile(path.join(directory, 'missing.ts'), 'export const missing = 1\n')
      expect((await auditCoverage(directory, report)).missingFiles).toEqual(['missing.ts'])
      await rm(path.join(directory, 'missing.ts'))
      await writeFile(source, '/* v8 ignore next */\nexport const value = 1\n')
      expect((await auditCoverage(directory, report)).ignoredFiles).toEqual(['module.ts'])
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('uses integer branch totals at the exact ninety-nine-percent boundary', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'template-branches-'))
    try {
      const source = path.join(directory, 'module.ts')
      const report = path.join(directory, 'coverage.json')
      await writeFile(source, 'export const value = 1\n')
      await writeFile(report, JSON.stringify({ [source]: fileCoverage(source, [1], [...Array.from<number>({ length: 99 }).fill(1), 0]) }))
      expect((await auditCoverage(directory, report)).accepted).toBe(true)
      await writeFile(report, JSON.stringify({ [source]: fileCoverage(source, [1], [...Array.from<number>({ length: 98 }).fill(1), 0, 0]) }))
      expect((await auditCoverage(directory, report)).accepted).toBe(false)
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
