import { readFile, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import { verifyNativeExports, verifyNativeReport } from './gate.mjs'
import { baselineManifest, loadManifest, manifestPath, validateManifest } from './manifest.mjs'
import { candidateFixture, completeReport, extendedManifest } from './testHelpers.mjs'

const roots = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('candidate native correctness manifest', () => {
  it('keeps the restored coverage increments in the trusted driver baseline', () => {
    const before = structuredClone(baselineManifest)
    const suiteFiles = new Set(before.suites.map(suite => suite.file))
    expect(suiteFiles).toEqual(new Set([
      'test/compilerAnalysis.test.ts',
      'test/compilerAmbientParity.test.ts',
      'test/npmChunkRewriteParity.test.ts',
      'test/npmChunksParity.test.ts',
      'test/onPageScroll.test.ts',
      'test/vueSfcSignature.fuzz.test.ts',
      'test/reservedPropsParity.test.ts',
      'test/defaultExportParity.test.ts',
    ]))
    expect(before.requiredExports).toContain('analyzeNpmChunksNative')
    expect(validateManifest(extendedManifest())).toEqual(before)
    expect(baselineManifest).toEqual(before)
  })

  it.each(['test/reservedPropsParity.test.ts', 'test/defaultExportParity.test.ts'])('rejects omitted or partial candidate-only %s', (file) => {
    const coverage = extendedManifest()
    const root = path.resolve('fixture-candidate')
    const report = completeReport(root, coverage)
    const index = coverage.suites.findIndex(suite => suite.file === file)
    const omitted = coverage.suites[index]
    report.testResults.splice(index, 1)
    const count = coverage.suites.reduce((sum, suite) => sum + suite.minimumAssertions, 0) - omitted.minimumAssertions
    report.numTotalTests = report.numPassedTests = count
    expect(() => verifyNativeReport(report, path.join(root, 'packages/ast-native'), coverage)).toThrow('omits suites')
    const partial = completeReport(root, coverage)
    partial.testResults[index].assertionResults.pop()
    partial.numTotalTests--
    partial.numPassedTests--
    expect(() => verifyNativeReport(partial, path.join(root, 'packages/ast-native'), coverage)).toThrow('partial')
  })

  it.each([
    value => value.schemaVersion = 2,
    value => value.shell = 'pnpm test',
    value => value.requiredExports.pop(),
    value => value.requiredExports.push('analyzeCompilerScriptsNative'),
    value => value.requiredExports.push('--require=inject'),
    value => value.buildFilters = ['weapp-vite...'],
    value => value.buildFilters.push('*'),
    value => value.buildFilters.push('weapp-vite... --concurrency=8'),
    value => value.buildFilters.push('@wevu/compiler...'),
    value => value.suites.pop(),
    value => value.suites[0].minimumAssertions--,
    value => value.suites[0].minimumAssertions = 1.5,
    value => value.suites[0].minimumAssertions = 0,
    value => value.suites[0].file = '../outside.test.ts',
    value => value.suites[0].file = 'test/../../outside.test.ts',
    value => value.suites[0].file = 'test\\outside.test.ts',
    value => value.suites[0].file = 'test/*.test.ts',
    value => value.suites[0].file = '--passWithNoTests',
    value => value.suites.push(value.suites[0]),
    value => value.suites.push({ ...value.suites[0], file: value.suites[0].file.toUpperCase() }),
    value => value.suites[0].command = 'pnpm test',
  ])('rejects a narrowed or unrestricted candidate plan %#', (mutate) => {
    const value = structuredClone(baselineManifest)
    mutate(value)
    expect(() => validateManifest(value)).toThrow()
  })

  it.each([null, {}, [], { schemaVersion: 1 }])('rejects missing or malformed coverage %j', (value) => {
    expect(() => validateManifest(value)).toThrow()
  })

  it('requires the same expanded suites and exports in the report gate', () => {
    const coverage = extendedManifest()
    const root = path.resolve('fixture-candidate')
    const report = completeReport(root, coverage)
    const expectedAssertions = coverage.suites.reduce((sum, suite) => sum + suite.minimumAssertions, 0)
    expect(verifyNativeReport(report, path.join(root, 'packages/ast-native'), coverage).passed).toBe(expectedAssertions)
    report.testResults.pop()
    expect(() => verifyNativeReport(report, path.join(root, 'packages/ast-native'), coverage)).toThrow()
    const binding = Object.fromEntries(baselineManifest.requiredExports
      .filter(name => name !== 'analyzeNpmChunksNative')
      .map(name => [name, () => {}]))
    expect(() => verifyNativeExports(binding, coverage)).toThrow('analyzeNpmChunksNative')
  })

  it('does not treat the minimum assertion count as permission to skip additional tests', () => {
    const coverage = extendedManifest()
    const root = path.resolve('fixture-candidate')
    const report = completeReport(root, coverage)
    report.testResults[0].assertionResults.push({ status: 'skipped', failureMessages: [] })
    report.numTotalTests++
    report.numPassedTests++
    expect(() => verifyNativeReport(report, path.join(root, 'packages/ast-native'), coverage)).toThrow('skipped')
  })

  it('reads the exact candidate bytes and rejects missing suites or a mismatched workspace target', async () => {
    const fixture = await candidateFixture()
    roots.push(fixture.root)
    const loaded = await loadManifest(fixture.root)
    expect(loaded.manifest).toEqual(fixture.manifest)
    expect(loaded.bytes).toEqual(await readFile(path.join(fixture.root, manifestPath)))
    const suite = path.join(fixture.root, 'packages/ast-native', fixture.manifest.suites[0].file)
    await rm(suite)
    await expect(loadManifest(fixture.root)).rejects.toThrow()
    await writeFile(suite, '// restored fixture\n')
    await writeFile(path.join(fixture.root, 'packages/weapp-vite/package.json'), '{"name":"unexpected"}')
    await expect(loadManifest(fixture.root)).rejects.toThrow('workspace package')
  })

  it('rejects a suite symlink escaping the candidate checkout', async () => {
    const coverage = extendedManifest()
    coverage.suites.push({ file: 'test/escape/compilerAnalysis.test.ts', minimumAssertions: 1 })
    const fixture = await candidateFixture(coverage)
    const neighbor = await candidateFixture()
    roots.push(fixture.root, neighbor.root)
    const suiteDirectory = path.join(fixture.root, 'packages/ast-native/test/escape')
    await rm(suiteDirectory, { recursive: true })
    await symlink(path.join(neighbor.root, 'packages/ast-native/test'), suiteDirectory, process.platform === 'win32' ? 'junction' : 'dir')
    await expect(loadManifest(fixture.root)).rejects.toThrow('escapes candidate')
  })
})
